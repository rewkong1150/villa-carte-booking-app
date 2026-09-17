import { RecordModel } from 'pocketbase';
import { pb } from '../pocketbase/config';
import { Booking, EmailNotification } from '../types';

const BOOKINGS_COLLECTION = 'bookings';
const NOTIFICATIONS_COLLECTION = 'emailNotifications';

// PocketBase assigns its own record `id` + `created`/`updated` timestamps —
// these adapters map that shape onto the app's existing Booking/EmailNotification
// types so every component built against those types keeps working unchanged.
const toBooking = (record: RecordModel): Booking => ({
  id: record.id,
  roomId: record.roomId,
  title: record.title,
  description: record.description || undefined,
  userId: record.userId,
  userName: record.userName,
  userEmail: record.userEmail,
  department: record.department,
  startTime: record.startTime,
  endTime: record.endTime,
  attendeesCount: record.attendeesCount,
  guestEmails: record.guestEmails && record.guestEmails.length > 0 ? record.guestEmails : undefined,
  googleCalendarEventId: record.googleCalendarEventId || undefined,
  googleCalendarEventLink: record.googleCalendarEventLink || undefined,
  status: record.status,
  createdAt: record.created,
  updatedAt: record.updated !== record.created ? record.updated : undefined,
});

const toEmailNotification = (record: RecordModel): EmailNotification => ({
  id: record.id,
  type: record.type,
  recipientEmail: record.recipientEmail,
  recipientName: record.recipientName,
  subject: record.subject,
  bodyHtml: record.bodyHtml,
  sentAt: record.sentAt,
  read: !!record.read,
  bookingDetails: record.bookingDetails,
  emailSent: record.emailSent,
  emailSentAt: record.emailSentAt || undefined,
  emailError: record.emailError || undefined,
});

export const subscribeBookings = (onUpdate: (bookings: Booking[]) => void): (() => void) => {
  let currentList: Booking[] = [];
  let disposed = false;
  let unsubscribeFn: (() => void) | null = null;

  const emit = () => {
    if (!disposed) onUpdate([...currentList]);
  };

  const init = async () => {
    try {
      const records = await pb.collection(BOOKINGS_COLLECTION).getFullList({ sort: '-startTime' });

      if (disposed) return;
      currentList = records.map(toBooking);
      emit();

      unsubscribeFn = await pb.collection(BOOKINGS_COLLECTION).subscribe('*', (e) => {
        if (e.action === 'create') {
          currentList = [toBooking(e.record), ...currentList.filter((b) => b.id !== e.record.id)];
        } else if (e.action === 'update') {
          currentList = currentList.map((b) => (b.id === e.record.id ? toBooking(e.record) : b));
        } else if (e.action === 'delete') {
          currentList = currentList.filter((b) => b.id !== e.record.id);
        }
        emit();
      });

      if (disposed && unsubscribeFn) unsubscribeFn();
    } catch (err) {
      console.error('Error subscribing to bookings in PocketBase:', err);
    }
  };

  init();

  return () => {
    disposed = true;
    if (unsubscribeFn) unsubscribeFn();
  };
};

export const addBookingToStore = async (
  booking: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Booking> => {
  const record = await pb.collection(BOOKINGS_COLLECTION).create(booking);
  return toBooking(record);
};

export const updateBookingInStore = async (
  bookingId: string,
  updates: Partial<Booking>
): Promise<void> => {
  const { updatedAt, ...cleanUpdates } = updates as Partial<Booking> & { updatedAt?: string };
  await pb.collection(BOOKINGS_COLLECTION).update(bookingId, cleanUpdates);
};

export const deleteBookingFromStore = async (bookingId: string): Promise<void> => {
  await pb.collection(BOOKINGS_COLLECTION).delete(bookingId);
};

export const subscribeEmailNotifications = (
  onUpdate: (notifications: EmailNotification[]) => void
): (() => void) => {
  let currentList: EmailNotification[] = [];
  let disposed = false;
  let unsubscribeFn: (() => void) | null = null;

  const sortNewestFirst = (list: EmailNotification[]) =>
    [...list].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  const emit = () => {
    if (!disposed) onUpdate(sortNewestFirst(currentList));
  };

  const init = async () => {
    try {
      const records = await pb.collection(NOTIFICATIONS_COLLECTION).getFullList({ sort: '-sentAt' });
      if (disposed) return;
      currentList = records.map(toEmailNotification);
      emit();

      unsubscribeFn = await pb.collection(NOTIFICATIONS_COLLECTION).subscribe('*', (e) => {
        if (e.action === 'create') {
          currentList = [toEmailNotification(e.record), ...currentList.filter((n) => n.id !== e.record.id)];
        } else if (e.action === 'update') {
          currentList = currentList.map((n) => (n.id === e.record.id ? toEmailNotification(e.record) : n));
        } else if (e.action === 'delete') {
          currentList = currentList.filter((n) => n.id !== e.record.id);
        }
        emit();
      });

      if (disposed && unsubscribeFn) unsubscribeFn();
    } catch (err) {
      console.error('Error subscribing to emailNotifications in PocketBase:', err);
    }
  };

  init();

  return () => {
    disposed = true;
    if (unsubscribeFn) unsubscribeFn();
  };
};

export const addEmailNotification = async (notification: Omit<EmailNotification, 'id'>): Promise<void> => {
  // pb_hooks/sendBookingEmail.pb.js picks this up on create and sends the real email via SMTP
  await pb.collection(NOTIFICATIONS_COLLECTION).create(notification);
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
  await pb.collection(NOTIFICATIONS_COLLECTION).update(notificationId, { read: true });
};

export const deleteEmailNotification = async (notificationId: string): Promise<void> => {
  await pb.collection(NOTIFICATIONS_COLLECTION).delete(notificationId);
};
