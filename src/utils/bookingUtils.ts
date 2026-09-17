import { Booking, Room, RoomId, RoomStatus, User } from '../types';
import { ADMIN_EMAIL, INITIAL_ROOMS } from '../data/initialData';

export interface ValidationResult {
  valid: boolean;
  /** Translation key for the i18n-aware error message (see LanguageContext.tsx) */
  messageKey?: string;
  /**
   * Params to interpolate into the translated message, e.g. {hours: 3} -> "{hours} hours".
   * Date values are left un-formatted so the caller can render them in the active UI language.
   */
  messageParams?: Record<string, string | number | Date>;
}

/**
 * Validates booking request against constraints:
 * 1. Cannot book a time slot that has already passed
 * 2. Floor 1 rooms require an admin override
 * 3. End time > Start time
 * 4. Attendee count must not exceed room capacity
 * 5. No overlapping bookings for the specified room
 * (Admin override bypasses all of the above except end-time > start-time.)
 */
export const validateBookingConstraints = (
  roomId: RoomId,
  start: Date,
  end: Date,
  existingBookings: Booking[],
  currentBookingIdToIgnore?: string,
  isAdminOverride = false,
  attendeesCount?: number,
  lang: AppLanguage = 'th'
): ValidationResult => {
  const now = new Date();
  const room = INITIAL_ROOMS.find((r) => r.id === roomId);

  // The booking form only has one date picker shared by both start and end
  // time (BookingModal.tsx), so there's no way to express an overnight
  // booking (e.g. 23:00 to 01:00) -- it always lands here, indistinguishable
  // from a genuine end-before-start typo. validationEndBeforeStart's wording
  // covers both: it now also says overnight bookings aren't supported yet,
  // instead of just looking like a data-entry mistake.
  if (end <= start) {
    return { valid: false, messageKey: 'validationEndBeforeStart' };
  }

  // 1. Cannot book a slot that has already started/passed
  if (start.getTime() < now.getTime() && !isAdminOverride) {
    return {
      valid: false,
      messageKey: 'validationPastStart',
    };
  }

  // Floor 1 rooms are walk-in/VIP rooms managed at the front desk — only an
  // admin (super-admin or app-admin) may book them; regular employees must
  // ask the admin to book on their behalf.
  if (room && room.floor === 1 && !isAdminOverride) {
    return {
      valid: false,
      messageKey: 'validationFloor1AdminOnly',
      messageParams: { roomName: getRoomName(room, lang) },
    };
  }

  // 4. Capacity check (upper AND lower bound -- the number input has min={1}
  // but that's only a browser-level nudge; nothing previously stopped a
  // direct API call from setting 0 or a negative attendee count)
  if (room && typeof attendeesCount === 'number') {
    if (attendeesCount > room.capacity) {
      return {
        valid: false,
        messageKey: 'validationCapacityExceeded',
        messageParams: { capacity: room.capacity, roomName: getRoomName(room, lang) },
      };
    }
    if (attendeesCount < 1) {
      return { valid: false, messageKey: 'validationAttendeesInvalid' };
    }
  }

  // 5. Collision check
  const reqStartMs = start.getTime();
  const reqEndMs = end.getTime();

  const activeBookingsForRoom = existingBookings.filter(
    (b) => b.roomId === roomId && b.status === 'confirmed' && b.id !== currentBookingIdToIgnore
  );

  for (const bk of activeBookingsForRoom) {
    const bkStartMs = new Date(bk.startTime).getTime();
    const bkEndMs = new Date(bk.endTime).getTime();

    // Check overlap: (StartA < EndB) && (EndA > StartB)
    if (reqStartMs < bkEndMs && reqEndMs > bkStartMs) {
      return {
        valid: false,
        messageKey: 'validationOverlap',
        messageParams: {
          roomName: room ? getRoomName(room, lang) : roomId,
          userName: bk.userName,
          title: bk.title,
          start: new Date(bk.startTime),
          end: new Date(bk.endTime),
        },
      };
    }
  }

  return { valid: true };
};

/**
 * Calculates real-time room status at a given reference time (defaults to now)
 */
export const getRoomRealtimeStatus = (roomId: RoomId, bookings: Booking[], refTime = new Date()): RoomStatus => {
  const refMs = refTime.getTime();

  const roomBookings = bookings
    .filter((b) => b.roomId === roomId && b.status === 'confirmed')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // Current ongoing booking
  const currentBooking = roomBookings.find((b) => {
    const s = new Date(b.startTime).getTime();
    const e = new Date(b.endTime).getTime();
    return s <= refMs && refMs < e;
  });

  // Next upcoming booking today or in future
  const nextBooking = roomBookings.find((b) => {
    const s = new Date(b.startTime).getTime();
    return s > refMs;
  });

  return {
    roomId,
    isOccupied: !!currentBooking,
    currentBooking,
    nextBooking,
  };
};

/**
 * Checks if a signed-in identity is an admin — either the single hardcoded
 * super-admin email, or an app-admin (the `isAppAdmin` flag on their
 * PocketBase `users` record, granted by the super-admin via the Admin UI).
 */
export const isAdminUser = (email?: string, isAppAdmin?: boolean): boolean => {
  if (!!isAppAdmin) return true;
  if (!email) return false;
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
};

/**
 * Checks if a user can modify/cancel a booking.
 * Rule: Normal users can only cancel/edit THEIR OWN bookings. Any admin
 * (super-admin or app-admin — both surfaced via `role`) can modify ANY booking.
 */
export const canUserModifyBooking = (booking: Booking, user?: Pick<User, 'email' | 'role'>): boolean => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return booking.userEmail.toLowerCase() === user.email.toLowerCase();
};

// Multi-language date formatters (Thai / English / Russian)
export type AppLanguage = 'th' | 'en' | 'ru';

/**
 * Room only has `name` (Thai) and `nameEn` (English) — there's no separate
 * Russian translation, so Russian falls back to English rather than Thai
 * (closer to what a non-Thai-reading user actually needs).
 */
export const getRoomName = (room: Room | undefined | null, lang: AppLanguage): string => {
  if (!room) return '';
  return lang === 'th' ? room.name : room.nameEn;
};

/**
 * Short room identifier for tight spaces (e.g. calendar cells). Room names are
 * generic ("Big Meeting Room 1") and repeat per floor, so the floor number is
 * included to keep labels unique — this is language-independent by design
 * rather than re-branching per language.
 */
export const getRoomShortLabel = (room: Room | undefined | null): string => {
  if (!room) return '';
  return `${room.nameEn.split(' ')[0]} F${room.floor}`;
};

export const MONTH_NAMES: Record<AppLanguage, string[]> = {
  th: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
};

export const MONTH_NAMES_SHORT: Record<AppLanguage, string[]> = {
  th: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ru: ['янв.', 'февр.', 'март', 'апр.', 'май', 'июнь', 'июль', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'],
};

export const DAY_NAMES: Record<AppLanguage, string[]> = {
  th: ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ru: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
};

export const DAY_NAMES_SHORT: Record<AppLanguage, string[]> = {
  th: ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
};

// The rooms this app books are physically in Bangkok, so a booking's
// displayed date/time must always mean Bangkok wall-clock time -- regardless
// of the VIEWING device's own timezone setting. Reading a Date with the
// native local getters (getHours/getDate/...) instead uses whatever
// timezone the browser happens to be set to, which is wrong for anyone
// whose device isn't on Thailand time (a traveling employee, a misconfigured
// laptop clock, etc: everyone would otherwise see a DIFFERENT wall-clock
// time for the exact same booking). Thailand has no DST, so the offset is a
// fixed +7h and this shift-then-read-as-UTC trick is exact and DST-safe.
const BANGKOK_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Constructs the correct UTC instant for a Bangkok wall-clock date/time --
 * the counterpart to toBangkokParts below. `month` is 1-indexed (matches the
 * `<input type="date">` value format), unlike JS's native 0-indexed Date().
 * Use this instead of `new Date(year, month, day, hours, minutes)` for any
 * booking-time input: that constructor uses the BROWSER's local timezone,
 * which silently produces the wrong absolute instant for anyone not on
 * Thailand time.
 */
export const bangkokWallTimeToDate = (year: number, month: number, day: number, hours: number, minutes: number): Date => {
  return new Date(Date.UTC(year, month - 1, day, hours, minutes) - BANGKOK_UTC_OFFSET_MS);
};

/**
 * "YYYY-MM-DD" for an `<input type="date">` value, in Bangkok time. Using
 * `date.toISOString().split('T')[0]` (UTC) or `date.toDateString()`/local
 * getters (viewer's own timezone) both drift from the Bangkok date near
 * local midnight -- neither one means "the Bangkok calendar day".
 */
export const toBangkokDateInputValue = (date: Date): string => {
  const { year, monthIndex, day } = toBangkokParts(date);
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/** "HH:MM" for an `<input type="time">` value, in Bangkok time. */
export const toBangkokTimeInputValue = (date: Date): string => {
  const { hours, minutes } = toBangkokParts(date);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/** Exposed for call sites that need to compare a stored instant's Bangkok
 * calendar day against a locally-navigated year/month/day (e.g. MonthlySchedule's
 * "which day cell does this booking belong to" grid logic). */
export const toBangkokParts = (date: Date) => {
  const shifted = new Date(date.getTime() + BANGKOK_UTC_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    monthIndex: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
  };
};

/** Full date, e.g. "วันเสาร์ที่ 5 กรกฎาคม พ.ศ. 2568" / "Saturday, July 5, 2025" */
export const formatDate = (date: Date, lang: AppLanguage = 'th'): string => {
  const { year, monthIndex, day, weekday } = toBangkokParts(date);
  const month = MONTH_NAMES[lang][monthIndex];
  const dayName = DAY_NAMES[lang][weekday];

  if (lang === 'th') {
    return `วัน${dayName}ที่ ${day} ${month} พ.ศ. ${year + 543}`;
  }
  if (lang === 'ru') {
    return `${dayName}, ${day} ${month} ${year} г.`;
  }
  return `${dayName}, ${month} ${day}, ${year}`;
};

/** Short date, e.g. "5 ก.ค. 2568" / "Jul 5, 2025" / "5 июл. 2025" */
export const formatDateShort = (date: Date, lang: AppLanguage = 'th'): string => {
  const { year, monthIndex, day } = toBangkokParts(date);
  const month = MONTH_NAMES_SHORT[lang][monthIndex];
  const displayYear = lang === 'th' ? year + 543 : year;

  if (lang === 'en') return `${month} ${day}, ${displayYear}`;
  return `${day} ${month} ${displayYear}`;
};

/** Time, e.g. "14:30 น." for Thai, "14:30" for English/Russian */
export const formatTime = (date: Date, lang: AppLanguage = 'th'): string => {
  const { hours, minutes } = toBangkokParts(date);
  const h = hours.toString().padStart(2, '0');
  const m = minutes.toString().padStart(2, '0');
  return lang === 'th' ? `${h}:${m} น.` : `${h}:${m}`;
};

// Backwards-compatible Thai-only aliases
export const formatThaiDateShort = (date: Date): string => formatDateShort(date, 'th');
export const formatThaiTime = (date: Date): string => formatTime(date, 'th');

export const formatTimeRange = (startIso: string, endIso: string, lang: AppLanguage = 'th'): string => {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return `${formatTime(start, lang)} - ${formatTime(end, lang)}`;
};

export const formatDurationHours = (startIso: string, endIso: string): number => {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const hours = (end - start) / (1000 * 60 * 60);
  return Math.round(hours * 10) / 10;
};
