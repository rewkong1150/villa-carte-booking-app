import { Booking, Room } from '../types';
import { translations, Language } from '../context/LanguageContext';
import { getRoomName } from '../utils/bookingUtils';
import { getDepartmentLabel } from '../data/departments';

const floorLabel = (lang: Language, floor: number) => translations[lang].floorBadge.replace('{floor}', String(floor));

let cachedAccessToken: string | null = null;

// Persisted in localStorage (not sessionStorage) so the token survives opening
// the app in a new tab or after closing/reopening the browser — sessionStorage
// is scoped per-tab, which meant Google Calendar sync silently stopped working
// (while the PocketBase login itself, stored in localStorage, stayed active)
// the moment a user opened a second tab or restarted their browser.
if (typeof window !== 'undefined') {
  cachedAccessToken = localStorage.getItem('vc_google_access_token');
}

export const setGoogleAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (token) {
    localStorage.setItem('vc_google_access_token', token);
  } else {
    localStorage.removeItem('vc_google_access_token');
  }
};

export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Google access tokens expire after ~1 hour and this app has no refresh-token
 * flow, so a token can be present but stale. Distinguishing 'auth_expired'
 * (and 'no_token') from 'other' lets the caller prompt the user to reconnect
 * Google instead of silently doing nothing, which is what made Google
 * Calendar sync look "broken" — the booking + email notification still
 * succeeded via an unrelated code path, so the failure was invisible.
 */
// A single (non-union) shape rather than a discriminated union: this project's
// tsconfig doesn't enable strictNullChecks, and without it TypeScript's
// control-flow narrowing for discriminated unions is unreliable (confirmed:
// `if (r.ok) {...} else if (r.reason === 'x')` fails to narrow away the
// success variant and errors on `.reason` not existing). An optional field
// on one interface sidesteps that entirely.
export interface CalendarSyncResult {
  ok: boolean;
  eventId?: string;
  htmlLink?: string;
  reason?: 'no_token' | 'auth_expired' | 'other';
}

/**
 * Creates an event on the user's primary Google Calendar
 */
export async function createGoogleCalendarEvent(
  booking: Booking,
  room: Room,
  accessTokenOverride?: string,
  lang: Language = 'th'
): Promise<CalendarSyncResult> {
  const token = accessTokenOverride || cachedAccessToken;
  if (!token) {
    console.warn('Google Calendar token missing. Skipping Google Calendar sync.');
    return { ok: false, reason: 'no_token' };
  }

  const tr = translations[lang];
  const roomName = getRoomName(room, lang);
  const departmentLabel = getDepartmentLabel(booking.department, lang);

  const attendees: { email: string; displayName?: string; resource?: boolean }[] = [
    { email: booking.userEmail, displayName: booking.userName },
  ];

  if (booking.guestEmails && booking.guestEmails.length > 0) {
    booking.guestEmails.forEach((email) => {
      if (email && email.trim() && !attendees.some((a) => a.email.toLowerCase() === email.trim().toLowerCase())) {
        attendees.push({ email: email.trim(), displayName: email.trim().split('@')[0] });
      }
    });
  }

  // Inviting the room's Google Workspace Calendar Resource as an attendee
  // (resource: true) is what makes this booking actually show as busy on
  // the room's real Google Calendar resource -- visible/conflict-checked
  // from Google Calendar directly, not just inside this app. A room without
  // a mapped resourceEmail (see initialData.ts) still books normally, just
  // without that reflection.
  if (room.resourceEmail) {
    attendees.push({ email: room.resourceEmail, resource: true });
  }

  const descriptionParts = [
    `📅 ${tr.calendarHeader}`,
    `----------------------------------------`,
    `📌 ${tr.emailLabelTopic}: ${booking.title}`,
    `🏢 ${tr.emailLabelRoom}: ${roomName} (${floorLabel(lang, room.floor)})`,
    `👤 ${tr.emailLabelBooker}: ${booking.userName} (${booking.userEmail})`,
    `🏢 ${tr.emailLabelDept}: ${departmentLabel}`,
    `👥 ${tr.calendarLabelAttendees}: ${booking.attendeesCount} ${tr.people}`,
  ];

  if (booking.description) {
    descriptionParts.push(`📝 ${tr.calendarLabelNotes}: ${booking.description}`);
  }

  if (booking.guestEmails && booking.guestEmails.length > 0) {
    descriptionParts.push(`📧 ${tr.calendarLabelGuestEmails}: ${booking.guestEmails.join(', ')}`);
  }

  const payload = {
    summary: `[${tr.calendarSummaryPrefix}] ${booking.title} (${roomName})`,
    location: `${roomName}, ${floorLabel(lang, room.floor)}, Villa Carte Group HQ`,
    description: descriptionParts.join('\n'),
    start: {
      dateTime: new Date(booking.startTime).toISOString(),
      timeZone: 'Asia/Bangkok',
    },
    end: {
      dateTime: new Date(booking.endTime).toISOString(),
      timeZone: 'Asia/Bangkok',
    },
    attendees,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 15 },
        { method: 'email', minutes: 30 },
      ],
    },
  };

  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.error('Failed to create Google Calendar event:', errJson);
      if (res.status === 401 || res.status === 403) {
        return { ok: false, reason: 'auth_expired' };
      }
      return { ok: false, reason: 'other' };
    }

    const data = await res.json();
    return {
      ok: true,
      eventId: data.id,
      htmlLink: data.htmlLink || `https://calendar.google.com/calendar/event?eid=${data.id}`,
    };
  } catch (err) {
    console.error('Google Calendar event creation failed:', err);
    return { ok: false, reason: 'other' };
  }
}

/**
 * Updates an existing Google Calendar event
 */
export interface CalendarUpdateResult {
  ok: boolean;
  reason?: 'no_token' | 'auth_expired' | 'other';
}

export async function updateGoogleCalendarEvent(
  eventId: string,
  booking: Booking,
  room: Room,
  accessTokenOverride?: string,
  lang: Language = 'th'
): Promise<CalendarUpdateResult> {
  const token = accessTokenOverride || cachedAccessToken;
  if (!token || !eventId) return { ok: false, reason: 'no_token' };

  const tr = translations[lang];
  const roomName = getRoomName(room, lang);
  const departmentLabel = getDepartmentLabel(booking.department, lang);

  const attendees: { email: string; displayName?: string; resource?: boolean }[] = [
    { email: booking.userEmail, displayName: booking.userName },
  ];

  if (booking.guestEmails && booking.guestEmails.length > 0) {
    booking.guestEmails.forEach((email) => {
      if (email && email.trim() && !attendees.some((a) => a.email.toLowerCase() === email.trim().toLowerCase())) {
        attendees.push({ email: email.trim(), displayName: email.trim().split('@')[0] });
      }
    });
  }

  // Rebuilding the full attendees array (incl. the resource) on every update
  // is important, not just on create: if the booking's ROOM changed, this
  // correctly swaps which resource calendar is invited too (Google Calendar
  // API replaces list-valued fields like attendees wholesale on PATCH).
  if (room.resourceEmail) {
    attendees.push({ email: room.resourceEmail, resource: true });
  }

  const descriptionParts = [
    `📅 ${tr.calendarHeaderUpdated}`,
    `----------------------------------------`,
    `📌 ${tr.emailLabelTopic}: ${booking.title}`,
    `🏢 ${tr.emailLabelRoom}: ${roomName} (${floorLabel(lang, room.floor)})`,
    `👤 ${tr.emailLabelBooker}: ${booking.userName} (${booking.userEmail})`,
    `🏢 ${tr.emailLabelDept}: ${departmentLabel}`,
    `👥 ${tr.calendarLabelAttendees}: ${booking.attendeesCount} ${tr.people}`,
  ];

  if (booking.description) {
    descriptionParts.push(`📝 ${tr.calendarLabelNotes}: ${booking.description}`);
  }

  const payload = {
    summary: `[${tr.calendarSummaryPrefix}] ${booking.title} (${roomName})`,
    location: `${roomName}, ${floorLabel(lang, room.floor)}, Villa Carte Group HQ`,
    description: descriptionParts.join('\n'),
    start: {
      dateTime: new Date(booking.startTime).toISOString(),
      timeZone: 'Asia/Bangkok',
    },
    end: {
      dateTime: new Date(booking.endTime).toISOString(),
      timeZone: 'Asia/Bangkok',
    },
    attendees,
  };

  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      console.error('Failed to update Google Calendar event:', errJson);
      if (res.status === 401 || res.status === 403) {
        return { ok: false, reason: 'auth_expired' };
      }
      return { ok: false, reason: 'other' };
    }
    return { ok: true };
  } catch (err) {
    console.error('Failed to update Google Calendar event:', err);
    return { ok: false, reason: 'other' };
  }
}

/**
 * Deletes a Google Calendar event. Returns the same shape as create/update so
 * the caller can tell "no calendar to sync" apart from "tried and failed" --
 * previously this returned a plain boolean that handleCancelBooking in
 * App.tsx never even checked, so a failed delete (e.g. expired Calendar
 * token) left the event sitting on Google Calendar looking still-booked
 * while the app already showed it as cancelled, with no error surfaced
 * anywhere. 404 counts as success: the event is already gone either way.
 */
export async function deleteGoogleCalendarEvent(
  eventId: string,
  accessTokenOverride?: string
): Promise<CalendarUpdateResult> {
  const token = accessTokenOverride || cachedAccessToken;
  if (!token || !eventId) return { ok: false, reason: 'no_token' };

  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok || res.status === 404) return { ok: true };
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'auth_expired' };
    return { ok: false, reason: 'other' };
  } catch (err) {
    console.error('Failed to delete Google Calendar event:', err);
    return { ok: false, reason: 'other' };
  }
}
