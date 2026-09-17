import React, { useState, useEffect } from 'react';
import { Room, Booking, User, EmailNotification, Ticket, TicketCategory, TicketPriority } from './types';
import { INITIAL_ROOMS, ADMIN_EMAIL } from './data/initialData';
import { formatDateShort, formatTime, getRoomName, isAdminUser } from './utils/bookingUtils';
import { getDepartmentLabel } from './data/departments';
import { pb } from './pocketbase/config';
import {
  subscribeBookings,
  addBookingToStore,
  updateBookingInStore,
  deleteBookingFromStore,
  subscribeEmailNotifications,
  addEmailNotification,
  markNotificationRead,
  deleteEmailNotification,
} from './services/bookingService';
import { subscribeTickets, addTicket, updateTicket } from './services/ticketService';
import {
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  setGoogleAccessToken,
} from './services/googleCalendarService';
import { NAV_ITEMS, TabKey, HELPDESK_VISIBILITY } from './config/navigation';
import { useLanguage } from './context/LanguageContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { RealtimeStatusBar } from './components/RealtimeStatusBar';
import { FloorPlan } from './components/FloorPlan';
import { MonthlySchedule } from './components/MonthlySchedule';
import { MyBookings } from './components/MyBookings';
import { AdminDashboard } from './components/AdminDashboard';
import { BookingModal } from './components/BookingModal';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { EmailDrawer } from './components/EmailDrawer';
import { Helpdesk } from './components/Helpdesk';
import { NewTicketModal } from './components/NewTicketModal';
import { CheckCircle2, AlertCircle, Info, Building2, Calendar, X, Loader2 } from 'lucide-react';

const DEPARTMENTS_STORAGE_KEY = 'vcg_departments';

const getStoredDepartment = (email: string): string | null => {
  try {
    const map = JSON.parse(localStorage.getItem(DEPARTMENTS_STORAGE_KEY) || '{}');
    return map[email.toLowerCase()] || null;
  } catch {
    return null;
  }
};

const setStoredDepartment = (email: string, department: string) => {
  try {
    const map = JSON.parse(localStorage.getItem(DEPARTMENTS_STORAGE_KEY) || '{}');
    map[email.toLowerCase()] = department;
    localStorage.setItem(DEPARTMENTS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors (e.g. private browsing)
  }
};

export default function App() {
  const { language, setLanguage, t } = useLanguage();

  // Navigation State
  const [activeTab, setActiveTab] = useState<TabKey>('schedule');

  // Real-time ticking time state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Master State
  const [rooms] = useState<Room[]>(INITIAL_ROOMS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [emailNotifications, setEmailNotifications] = useState<EmailNotification[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  // Auth state — the ONLY source of truth is PocketBase's authStore.
  // There is no default/fallback identity: a signed-out browser sees the sign-in gate, never the app.
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Modal Control States
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedRoomForBooking, setSelectedRoomForBooking] = useState<Room['id'] | undefined>();
  const [scheduleRoomFilter, setScheduleRoomFilter] = useState<Room['id'] | undefined>();
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isEmailDrawerOpen, setIsEmailDrawerOpen] = useState(false);
  const [viewDetailBooking, setViewDetailBooking] = useState<Booking | null>(null);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(
    null
  );

  // 1. Subscribe to PocketBase Realtime Bookings — only once signed in, since
  // the API rules reject anonymous list/subscribe requests anyway.
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeBookings((updatedBookings) => {
      setBookings(updatedBookings);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // 2. Subscribe to PocketBase Realtime Email Notifications — same gating.
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeEmailNotifications((updatedNotifications) => {
      setEmailNotifications(updatedNotifications);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // 2b. Subscribe to PocketBase Realtime IT Helpdesk tickets — same gating.
  // The server rule already scopes this to "own tickets" for regular users
  // and "all tickets" for isITStaff/admin, so no client-side filtering needed.
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = subscribeTickets((updatedTickets) => {
      setTickets(updatedTickets);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // 3. PocketBase's authStore is the single source of truth for who is signed in.
  useEffect(() => {
    // authStore restores its cached token synchronously from local storage on
    // load — confirm it's still valid server-side (not expired/revoked) rather
    // than trusting the cache blindly. Re-validate periodically too (not just
    // once), AND whenever the tab/app becomes visible again — a background
    // tab's setInterval timers get throttled/paused by the browser (mobile
    // Safari especially, per a real report: an iPhone user's booking create
    // failed with a stale session right after reopening the app, before the
    // periodic check ever got a chance to run again). Without this, the UI
    // keeps showing the user as signed in, but every write (create/update a
    // booking or ticket) silently fails with a generic "couldn't complete"
    // error and no indication why. A successful authRefresh() also slides the
    // token's expiry forward, so regular use keeps a session alive longer.
    let cancelled = false;

    // Returns a promise so the initial check below can await it (closing the
    // loading screen only once the FIRST validity check truly finishes) —
    // subsequent calls (interval/visibility/focus) just let it run in the
    // background without re-showing any loading state.
    const revalidateSession = async () => {
      // isValid only decodes the cached JWT and checks its own embedded expiry
      // client-side — it never talks to the server. Previously this returned
      // early here, so an already-expired cached token was never cleared: the
      // onChange(subscriber, true) below still fires with that stale cached
      // user, so currentUser gets set and the UI renders as "signed in" while
      // every real API call quietly fails server-side (expired token rejected),
      // showing up as blank lists everywhere with no indication why.
      if (!pb.authStore.isValid) {
        pb.authStore.clear();
        return;
      }
      try {
        await pb.collection('users').authRefresh();
      } catch {
        pb.authStore.clear();
      }
    };

    const unsubscribe = pb.authStore.onChange((_token, model) => {
      if (model && model.email) {
        const email = model.email as string;
        const name = (model.name as string) || email.split('@')[0];
        const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`;
        const isAdmin = isAdminUser(email, model.isAppAdmin as boolean | undefined);

        setCurrentUser((prev) => ({
          id: model.id,
          name,
          email,
          department: getStoredDepartment(email) || prev?.department || 'Executive Management',
          avatar,
          role: isAdmin ? 'admin' : 'user',
          isITStaff: !!model.isITStaff,
        }));
      } else {
        setCurrentUser(null);
      }
    }, true);

    // Gate the loading screen on the FIRST check actually completing, instead
    // of just on the synchronous cached-state callback above firing — closes
    // a race where a stale-but-not-yet-invalidated session let the app render
    // as "signed in" for a brief window before the async check caught up,
    // during which a fast user could submit a booking that failed server-side.
    revalidateSession().then(() => {
      if (!cancelled) setAuthLoading(false);
    });

    const refreshInterval = setInterval(revalidateSession, 10 * 60 * 1000); // every 10 minutes

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') revalidateSession();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', revalidateSession);

    return () => {
      cancelled = true;
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', revalidateSession);
      unsubscribe();
    };
  }, []);

  // Realtime clock interval
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000); // Ticks every 30s
    return () => clearInterval(timer);
  }, []);

  const isAdmin = currentUser ? currentUser.role === 'admin' : false;
  const canSeeHelpdesk = HELPDESK_VISIBILITY === 'everyone' || isAdmin;
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => (item.key !== 'admin' || isAdmin) && (item.key !== 'helpdesk' || canSeeHelpdesk)
  );

  // Guard against a non-admin landing on the admin tab (e.g. stale state after sign-out/sign-in as a different user)
  useEffect(() => {
    if (currentUser && activeTab === 'admin' && !isAdmin) {
      setActiveTab('schedule');
    }
  }, [currentUser, isAdmin, activeTab]);

  // Helpdesk tab is admin-only during rollout (HELPDESK_VISIBILITY) — same
  // stale-state guard as the admin tab above.
  useEffect(() => {
    if (currentUser && activeTab === 'helpdesk' && !canSeeHelpdesk) {
      setActiveTab('schedule');
    }
  }, [currentUser, canSeeHelpdesk, activeTab]);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleSelectUser = (user: User) => {
    setStoredDepartment(user.email, user.department);
    setCurrentUser(user);
    showToast(t('signedInAsToast', { name: user.name, email: user.email }), 'info');
  };

  const handleLogout = () => {
    pb.authStore.clear();
    setCurrentUser(null);
  };

  // Trigger Email Generator in Firestore
  const triggerEmailNotification = async (
    type: EmailNotification['type'],
    booking: Booking,
    room: Room
  ) => {
    const nowIso = new Date().toISOString();
    const actionTitle =
      type === 'booking_created'
        ? t('emailActionCreated')
        : type === 'booking_cancelled'
        ? t('emailActionCancelled')
        : t('emailActionUpdated');

    const roomName = getRoomName(room, language);
    const departmentLabel = getDepartmentLabel(booking.department, language);
    const dateTimeStr = `${formatDateShort(new Date(booking.startTime), language)} | ${formatTime(
      new Date(booking.startTime), language
    )} - ${formatTime(new Date(booking.endTime), language)}`;

    const subject = `[Villa Carte Group] ${actionTitle}: ${roomName} - ${booking.title}`;

    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.6;">
        <h3 style="color: #1e1b4b; margin-bottom: 8px;">${actionTitle}</h3>
        <p><strong>${t('emailLabelRoom')}:</strong> ${roomName} (${t('floorBadge', { floor: room.floor })})</p>
        <p><strong>${t('emailLabelTopic')}:</strong> ${booking.title}</p>
        <p><strong>${t('emailLabelBooker')}:</strong> ${booking.userName} (${booking.userEmail})</p>
        <p><strong>${t('emailLabelDept')}:</strong> ${departmentLabel}</p>
        <p><strong>${t('emailLabelDateTime')}:</strong> ${dateTimeStr}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
        <p style="font-size: 12px; color: #64748b;">
          ${t('emailFooterAutoSent', { adminEmail: ADMIN_EMAIL })}
        </p>
      </div>
    `;

    const recipients = Array.from(
      new Set([booking.userEmail, ...(booking.guestEmails || [])].map((e) => e.trim()).filter((e) => e && e.includes('@')))
    );

    for (const email of recipients) {
      const isBooker = email.toLowerCase() === booking.userEmail.toLowerCase();
      const recipientName = isBooker ? booking.userName : email.split('@')[0];

      const newEmail: EmailNotification = {
        id: `email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        type,
        recipientEmail: email,
        recipientName,
        subject: isBooker ? subject : `[${t('emailInvitePrefix')}] ${roomName}: ${booking.title}`,
        bodyHtml: isBooker
          ? bodyHtml
          : `
          <div style="font-family: Arial, sans-serif; font-size: 14px; color: #334155; line-height: 1.6;">
            <h3 style="color: #047857; margin-bottom: 8px;">${t('emailInviteHeading')}</h3>
            <p>${t('emailInviteIntro', { name: `<strong>${booking.userName}</strong>`, email: booking.userEmail })}</p>
            <p><strong>${t('emailLabelTopic')}:</strong> ${booking.title}</p>
            <p><strong>${t('emailInviteLabelLocation')}:</strong> ${roomName} (${t('floorBadge', { floor: room.floor })}), Villa Carte Group HQ</p>
            <p><strong>${t('emailLabelDateTime')}:</strong> ${dateTimeStr}</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
            <p style="font-size: 12px; color: #64748b;">
              ${t('emailInviteFooterSynced')}
            </p>
          </div>
        `,
        sentAt: nowIso,
        read: false,
        bookingDetails: {
          roomName,
          floor: room.floor,
          title: booking.title,
          startTime: booking.startTime,
          endTime: booking.endTime,
          userName: booking.userName,
        },
      };

      // On failure, this used to fall back to pushing `newEmail` into local
      // state only -- making it look (in this booker's own Email Drawer) like
      // the notification was sent, when in fact it was never persisted to
      // PocketBase at all, so the pb_hooks/sendBookingEmail.pb.js hook that
      // actually sends the real email never even ran. No fallback anymore:
      // handleWriteError both recovers a stale session (the most common
      // cause) and surfaces the failure instead of hiding it.
      const { id: _localId, ...emailForServer } = newEmail;
      try {
        await addEmailNotification(emailForServer);
      } catch (err) {
        await handleWriteError(err, 'emailNotificationFailedToast');
      }
    }
  };

  // Shared write-failure handler for bookings/tickets: a create/update/delete
  // can fail either because of a real error, or because the session quietly
  // went stale (confirmed via a real incident — a mobile user's session died
  // while the app was backgrounded, and every write failed with a generic
  // "couldn't complete" toast that gave no indication a re-login would fix
  // it). Actively re-verifying with authRefresh() here tells the two apart:
  // if the server still accepts the session, it was some other failure; if
  // not, clear the stale session so the sign-in gate appears immediately
  // with a clear reason, instead of the user retrying the same action forever.
  const handleWriteError = async (err: unknown, fallbackToastKey: Parameters<typeof t>[0]) => {
    console.error('Write error:', err);

    // pb_hooks/preventBookingOverlap.pb.js rejects a create/update server-side
    // if someone else's booking won the same room+time race in between this
    // client's last overlap check and this submit -- give that its own clear
    // message instead of the generic fallback, so the user knows to just
    // pick a different time/room rather than blindly retrying the same one.
    const serverMessage = String((err as any)?.response?.message || (err as any)?.message || '');
    if (serverMessage.includes('already booked for the selected time')) {
      showToast(t('bookingRaceConditionToast'), 'error');
      return;
    }

    try {
      await pb.collection('users').authRefresh();
      showToast(t(fallbackToastKey), 'error');
    } catch {
      pb.authStore.clear();
      showToast(t('sessionExpiredToast'), 'error');
    }
  };

  // Booking Operations via PocketBase & Google Calendar
  const handleCreateBooking = async (
    bookingData: Omit<Booking, 'id' | 'createdAt'> & { syncGoogleCalendar?: boolean }
  ) => {
    const { syncGoogleCalendar, ...cleanData } = bookingData;
    const targetRoom = rooms.find((r) => r.id === cleanData.roomId) || rooms[0];

    let created: Booking;
    try {
      created = await addBookingToStore(cleanData);
    } catch (err) {
      await handleWriteError(err, 'bookingCreateFailedToast');
      return;
    }

    // Google Calendar Sync (best-effort, applied as a follow-up update once we have the real record id)
    let calendarSynced = false;
    if (syncGoogleCalendar) {
      const calResult = await createGoogleCalendarEvent(created, targetRoom, undefined, language);
      if (calResult.ok) {
        try {
          await updateBookingInStore(created.id, {
            googleCalendarEventId: calResult.eventId,
            googleCalendarEventLink: calResult.htmlLink,
          });
          created = { ...created, googleCalendarEventId: calResult.eventId, googleCalendarEventLink: calResult.htmlLink };
          calendarSynced = true;
        } catch (persistErr) {
          // The calendar event was created, but we couldn't record its id on
          // the booking. Left alone, this orphans the event: a later edit
          // would create a SECOND event (since the app thinks none exists),
          // and a later cancel would never delete the original. Best-effort
          // delete it now instead, and fall through to the plain "other"
          // sync-failure toast below rather than the calendar-synced one.
          console.error('Failed to persist Calendar event id, deleting orphaned event:', persistErr);
          await deleteGoogleCalendarEvent(calResult.eventId).catch(() => {});
          showToast(t('googleCalendarSyncFailedToast'), 'error');
        }
      } else if (calResult.reason === 'no_token') {
        showToast(t('googleAuthNotice'), 'info');
        setIsAuthModalOpen(true);
      } else if (calResult.reason === 'auth_expired') {
        setGoogleAccessToken(null);
        showToast(t('googleCalendarSyncExpiredToast'), 'error');
        setIsAuthModalOpen(true);
      } else {
        showToast(t('googleCalendarSyncFailedToast'), 'error');
      }
    }

    await triggerEmailNotification('booking_created', created, targetRoom);
    showToast(
      calendarSynced ? t('bookingCreatedGCalToast') : t('bookingCreatedToast', { title: created.title }),
      'success'
    );
  };

  const handleUpdateBooking = async (
    bookingId: string,
    updatedFields: Partial<Booking> & { syncGoogleCalendar?: boolean }
  ) => {
    const { syncGoogleCalendar, ...cleanFields } = updatedFields;
    const targetBooking = bookings.find((b) => b.id === bookingId);

    let calendarSyncIssue: 'no_token' | 'auth_expired' | 'other' | null = null;

    if (targetBooking) {
      const merged = { ...targetBooking, ...cleanFields };
      const targetRoom = rooms.find((r) => r.id === merged.roomId) || rooms[0];

      if (targetBooking.googleCalendarEventId) {
        const updateResult = await updateGoogleCalendarEvent(targetBooking.googleCalendarEventId, merged, targetRoom, undefined, language);
        if (!updateResult.ok) calendarSyncIssue = updateResult.reason;
      } else if (syncGoogleCalendar) {
        const calResult = await createGoogleCalendarEvent(merged, targetRoom, undefined, language);
        if (calResult.ok) {
          cleanFields.googleCalendarEventId = calResult.eventId;
          cleanFields.googleCalendarEventLink = calResult.htmlLink;
        } else {
          calendarSyncIssue = calResult.reason;
        }
      }
    }

    if (calendarSyncIssue === 'auth_expired') {
      setGoogleAccessToken(null);
      showToast(t('googleCalendarSyncExpiredToast'), 'error');
      setIsAuthModalOpen(true);
    } else if (calendarSyncIssue === 'no_token') {
      showToast(t('googleAuthNotice'), 'info');
      setIsAuthModalOpen(true);
    } else if (calendarSyncIssue === 'other') {
      showToast(t('googleCalendarSyncFailedToast'), 'error');
    }

    try {
      await updateBookingInStore(bookingId, cleanFields);
      if (targetBooking) {
        const targetRoom = rooms.find((r) => r.id === (cleanFields.roomId || targetBooking.roomId)) || rooms[0];
        await triggerEmailNotification('booking_updated', { ...targetBooking, ...cleanFields } as Booking, targetRoom);
      }
      showToast(t('bookingUpdatedToast'), 'info');
    } catch (err: any) {
      await handleWriteError(err, 'bookingCreateFailedToast');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    const target = bookings.find((b) => b.id === bookingId);
    if (!target) return;

    if (target.googleCalendarEventId) {
      const deleteResult = await deleteGoogleCalendarEvent(target.googleCalendarEventId);
      if (!deleteResult.ok) {
        if (deleteResult.reason === 'auth_expired') {
          setGoogleAccessToken(null);
          showToast(t('googleCalendarSyncExpiredToast'), 'error');
          setIsAuthModalOpen(true);
        } else if (deleteResult.reason === 'no_token') {
          showToast(t('googleAuthNotice'), 'info');
          setIsAuthModalOpen(true);
        } else {
          showToast(t('googleCalendarSyncFailedToast'), 'error');
        }
      }
    }

    try {
      await updateBookingInStore(bookingId, { status: 'cancelled' });
      const targetRoom = rooms.find((r) => r.id === target.roomId) || rooms[0];
      await triggerEmailNotification('booking_cancelled', { ...target, status: 'cancelled' }, targetRoom);
      showToast(t('bookingCancelledToast', { title: target.title }), 'info');
    } catch (err: any) {
      await handleWriteError(err, 'bookingCreateFailedToast');
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    try {
      await deleteBookingFromStore(bookingId);
      showToast(t('bookingDeletedToast'), 'info');
    } catch (err: any) {
      await handleWriteError(err, 'bookingCreateFailedToast');
    }
  };

  const handleCreateTicket = async (data: {
    title: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
  }) => {
    if (!currentUser) return;
    try {
      await addTicket({
        ...data,
        requesterEmail: currentUser.email,
        requesterName: currentUser.name,
        requesterDepartment: currentUser.department,
      });
      setIsNewTicketModalOpen(false);
      showToast(t('ticketCreatedToast'), 'success');
    } catch (err) {
      await handleWriteError(err, 'ticketErrorToast');
    }
  };

  const handleUpdateTicket = async (ticketId: string, updates: Partial<Ticket>) => {
    try {
      await updateTicket(ticketId, updates);
      showToast(t('ticketUpdatedToast'), 'info');
    } catch (err) {
      await handleWriteError(err, 'ticketErrorToast');
    }
  };

  // Both of these used to update local state and show a success toast
  // BEFORE the actual server writes ran, with failures only console.error'd —
  // meaning on a stale session the toast would claim "cleared"/"marked read"
  // while PocketBase still had the old data, with no error and no recovery.
  // Now: write first, only reflect what actually succeeded, and route any
  // failure through handleWriteError like every other write in this file.
  const handleMarkAllNotificationsRead = async () => {
    const unread = emailNotifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    const results = await Promise.allSettled(unread.map((n) => markNotificationRead(n.id)));
    const succeededIds = new Set(unread.filter((_, i) => results[i].status === 'fulfilled').map((n) => n.id));
    const firstError = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')?.reason;

    if (succeededIds.size > 0) {
      setEmailNotifications((prev) => prev.map((n) => (succeededIds.has(n.id) ? { ...n, read: true } : n)));
    }
    if (firstError) {
      await handleWriteError(firstError, 'notificationsActionFailedToast');
    } else {
      showToast(t('notificationsMarkedReadToast'), 'info');
    }
  };

  const handleClearNotifications = async () => {
    const toClear = emailNotifications;
    if (toClear.length === 0) return;

    const results = await Promise.allSettled(toClear.map((n) => deleteEmailNotification(n.id)));
    const succeededIds = new Set(toClear.filter((_, i) => results[i].status === 'fulfilled').map((n) => n.id));
    const firstError = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')?.reason;

    if (succeededIds.size > 0) {
      setEmailNotifications((prev) => prev.filter((n) => !succeededIds.has(n.id)));
    }
    if (firstError) {
      await handleWriteError(firstError, 'notificationsActionFailedToast');
    } else {
      showToast(t('notificationsClearedToast'), 'info');
    }
  };

  const toastIcon = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
  };

  // --- Auth gates: loading / signed-out screens replace the entire app shell ---
  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0c2417] text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-200/80">Villa Carte Group</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen w-full bg-[#0c2417] flex flex-col items-center justify-center p-4 relative">
        {/* Language switcher — Header/Sidebar (where it normally lives) aren't rendered until after sign-in */}
        <div className="absolute top-4 right-4 flex items-center bg-white/5 p-1 rounded-xl border border-white/10 text-xs font-bold">
          {(['th', 'en', 'ru'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-2.5 py-1.5 rounded-lg transition-all min-h-[32px] uppercase ${
                language === lang ? 'bg-white text-[#0c2417]' : 'text-emerald-200/70 hover:text-white'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            VILLA<span className="text-emerald-400">CARTE</span>
          </h1>
          <p className="text-emerald-200/70 text-xs mt-2 max-w-sm mx-auto">{t('authGateDesc')}</p>
        </div>
        <GoogleAuthModal isOpen onClose={() => {}} onSelectUser={handleSelectUser} hideCloseButton />
        <p className="text-emerald-200/40 text-[11px] mt-6">{t('authGateFooter')}</p>

        {/* Same toast as the signed-in shell below — needed here too so a message set right
            before a forced sign-out (e.g. sessionExpiredToast) is actually visible, instead of
            vanishing the instant this gate replaces the signed-in view. */}
        {toastMessage && (
          <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
            <div
              className={`px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center space-x-3 text-white ${
                toastMessage.type === 'error'
                  ? 'bg-rose-900 border-rose-500/50'
                  : 'bg-slate-900 border-blue-500/50'
              }`}
            >
              {toastIcon[toastMessage.type]}
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] text-slate-900 font-sans overflow-hidden selection:bg-blue-600 selection:text-white">
      {/* Desktop Left Sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          currentUser={currentUser}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onLogout={handleLogout}
        />
      </div>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Console */}
        <Header
          currentUser={currentUser}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onOpenBookingModal={() => {
            setBookingToEdit(null);
            setSelectedRoomForBooking(undefined);
            setIsBookingModalOpen(true);
          }}
          onOpenEmailDrawer={() => setIsEmailDrawerOpen(true)}
          onLogout={handleLogout}
          emailNotifications={emailNotifications}
        />

        {/* Mobile Navigation Tabs */}
        <div className="lg:hidden flex items-center justify-around bg-slate-900 text-white py-2 px-2 text-xs shrink-0 border-b border-slate-800">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md font-medium min-h-[36px] ${
                  isActive
                    ? item.key === 'admin'
                      ? 'bg-amber-600 text-white'
                      : 'bg-blue-600 text-white'
                    : 'text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t(item.mobileLabelKey)}</span>
              </button>
            );
          })}
        </div>

        {/* Real-time Room Status Bar */}
        <RealtimeStatusBar
          rooms={rooms}
          bookings={bookings}
          currentTime={currentTime}
          onSelectRoom={(roomId) => {
            setSelectedRoomForBooking(roomId as Room['id']);
            setActiveTab('rooms');
          }}
        />

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {activeTab === 'rooms' && (
            <FloorPlan
              rooms={rooms}
              bookings={bookings}
              currentTime={currentTime}
              onBookRoom={(roomId) => {
                setSelectedRoomForBooking(roomId);
                setBookingToEdit(null);
                setIsBookingModalOpen(true);
              }}
              onViewSchedule={(roomId) => {
                setScheduleRoomFilter(roomId);
                setActiveTab('schedule');
              }}
            />
          )}

          {activeTab === 'schedule' && (
            <MonthlySchedule
              rooms={rooms}
              bookings={bookings}
              initialRoomFilter={scheduleRoomFilter}
              onSelectSlotToBook={(roomId) => {
                setSelectedRoomForBooking(roomId);
                setBookingToEdit(null);
                setIsBookingModalOpen(true);
              }}
              onSelectBookingToView={(bk) => setViewDetailBooking(bk)}
            />
          )}

          {activeTab === 'my-bookings' && (
            <MyBookings
              bookings={bookings}
              rooms={rooms}
              currentUser={currentUser}
              onCancelBooking={handleCancelBooking}
              onEditBooking={(bk) => {
                setBookingToEdit(bk);
                setIsBookingModalOpen(true);
              }}
            />
          )}

          {activeTab === 'helpdesk' && (
            <Helpdesk
              tickets={tickets}
              currentUser={currentUser}
              onNewTicket={() => setIsNewTicketModalOpen(true)}
              onUpdateTicket={handleUpdateTicket}
            />
          )}

          {activeTab === 'admin' && (
            <AdminDashboard
              bookings={bookings}
              rooms={rooms}
              currentUser={currentUser}
              onEditBooking={(bk) => {
                setBookingToEdit(bk);
                setIsBookingModalOpen(true);
              }}
              onDeleteBooking={handleDeleteBooking}
            />
          )}
        </main>

        {/* High Density Footer Action Bar */}
        <div className="px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between shrink-0 text-[11px] text-slate-500 gap-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 justify-center sm:justify-start">
            <span>🔵 <strong className="text-slate-700">{t('legendStandard')}</strong></span>
            <span>🟠 <strong className="text-slate-700">{t('legendAdmin')}</strong></span>
            <span>🟢 <strong className="text-slate-700">{t('legendVacant')}</strong></span>
          </div>
          <div className="text-center sm:text-right">{t('footerSummary')}</div>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center space-x-3 text-white ${
              toastMessage.type === 'error'
                ? 'bg-rose-900 border-rose-500/50'
                : 'bg-slate-900 border-blue-500/50'
            }`}
          >
            {toastIcon[toastMessage.type]}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Modals & Drawers */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        rooms={rooms}
        bookings={bookings}
        currentUser={currentUser}
        selectedRoomId={selectedRoomForBooking}
        initialBookingToEdit={bookingToEdit}
        onSubmitBooking={handleCreateBooking}
        onUpdateBooking={handleUpdateBooking}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      <GoogleAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSelectUser={handleSelectUser}
        defaultDepartment={currentUser?.department}
      />

      <EmailDrawer
        isOpen={isEmailDrawerOpen}
        onClose={() => setIsEmailDrawerOpen(false)}
        notifications={emailNotifications}
        onMarkAllAsRead={handleMarkAllNotificationsRead}
        onClearNotifications={handleClearNotifications}
      />

      <NewTicketModal
        isOpen={isNewTicketModalOpen}
        onClose={() => setIsNewTicketModalOpen(false)}
        onSubmit={handleCreateTicket}
      />

      {/* View Booking Detail Modal */}
      {viewDetailBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-100 space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{t('viewDetailTitle')}</h3>
                  <p className="text-xs text-slate-500">{t('viewDetailIdLabel')}: {viewDetailBooking.id}</p>
                </div>
              </div>
              <button
                onClick={() => setViewDetailBooking(null)}
                className="text-slate-400 hover:text-slate-700 p-1 min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
                <div className="font-extrabold text-slate-900 text-sm">{viewDetailBooking.title}</div>
                {viewDetailBooking.description && (
                  <p className="text-slate-600 leading-relaxed">{viewDetailBooking.description}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">{t('roomLabel')}</span>
                  <span className="font-bold text-slate-800">
                    {getRoomName(rooms.find((r) => r.id === viewDetailBooking.roomId), language)}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">{t('dateTimeLabel')}</span>
                  <span className="font-bold text-blue-600 font-mono">
                    {formatDateShort(new Date(viewDetailBooking.startTime), language)} <br />
                    {formatTime(new Date(viewDetailBooking.startTime), language)} - {formatTime(new Date(viewDetailBooking.endTime), language)}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">{t('bookerName')}</span>
                  <span className="font-bold text-slate-800">{viewDetailBooking.userName}</span>
                  <div className="text-[10px] text-slate-500">{viewDetailBooking.userEmail}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">{t('departmentTeam')}</span>
                  <span className="font-bold text-slate-800">{getDepartmentLabel(viewDetailBooking.department, language)}</span>
                </div>
              </div>

              {viewDetailBooking.guestEmails && viewDetailBooking.guestEmails.length > 0 && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="text-[#1b4332] text-[10px] font-bold block">{t('additionalGuestsLabel')}</span>
                  <span className="font-medium text-slate-800 text-xs">{viewDetailBooking.guestEmails.join(', ')}</span>
                </div>
              )}

              {viewDetailBooking.googleCalendarEventId && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-blue-800 text-xs font-bold flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" /> {t('syncedToGCalLabel')}
                  </span>
                  <a
                    href={viewDetailBooking.googleCalendarEventLink || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    {t('openInGCalLabel')}
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={() => setViewDetailBooking(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition min-h-[44px]"
            >
              {t('closeBtn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
