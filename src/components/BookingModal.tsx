import React, { useState, useEffect } from 'react';
import { Room, Booking, User } from '../types';
import {
  validateBookingConstraints,
  ValidationResult,
  formatDateShort,
  formatTime,
  getRoomName,
  bangkokWallTimeToDate,
  toBangkokDateInputValue,
  toBangkokTimeInputValue,
} from '../utils/bookingUtils';
import { DEPARTMENT_OPTIONS, getDepartmentLabel } from '../data/departments';
import { Calendar, Clock, Building2, AlertTriangle, CheckCircle2, Info, X, Lock } from 'lucide-react';
import { GuestInviteSelector } from './GuestInviteSelector';
import { useLanguage } from '../context/LanguageContext';
import { getGoogleAccessToken } from '../services/googleCalendarService';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: Room[];
  bookings: Booking[];
  currentUser: User;
  selectedRoomId?: Room['id'];
  initialBookingToEdit?: Booking | null;
  onSubmitBooking: (bookingData: Omit<Booking, 'id' | 'createdAt'> & { syncGoogleCalendar?: boolean }) => void;
  onUpdateBooking?: (bookingId: string, bookingData: Partial<Booking> & { syncGoogleCalendar?: boolean }) => void;
  /** Opens the Google sign-in/reconnect modal — used by the inline warning
   * banner below the date/time fields so a user whose Calendar connection has
   * expired notices (and can fix it) right when it matters, instead of only
   * finding out via a toast after they've already submitted the booking. */
  onOpenAuthModal: () => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  rooms,
  bookings,
  currentUser,
  selectedRoomId,
  initialBookingToEdit,
  onSubmitBooking,
  onUpdateBooking,
  onOpenAuthModal,
}) => {
  const { t, language } = useLanguage();
  const isAdmin = currentUser.role === 'admin';

  // Default initial date/time: next full hour from now (bookings can start any time, no advance-notice requirement)
  const getDefaultStartDate = () => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return d;
  };

  const defaultStart = getDefaultStartDate();
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000); // 1 hour meeting

  const getDefaultRoomId = (): Room['id'] => {
    const preferred = selectedRoomId ? rooms.find((r) => r.id === selectedRoomId) : undefined;
    if (preferred && (isAdmin || preferred.floor !== 1)) return preferred.id;
    const firstBookable = rooms.find((r) => isAdmin || r.floor !== 1);
    return firstBookable?.id || rooms[0]?.id || 'room-101';
  };

  const [roomId, setRoomId] = useState<Room['id']>(getDefaultRoomId());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState(toBangkokDateInputValue(defaultStart));
  const [startTimeStr, setStartTimeStr] = useState(toBangkokTimeInputValue(defaultStart));
  const [endTimeStr, setEndTimeStr] = useState(toBangkokTimeInputValue(defaultEnd));
  const [attendeesCount, setAttendeesCount] = useState(6);
  const [department, setDepartment] = useState(
    DEPARTMENT_OPTIONS.includes(currentUser.department) ? currentUser.department : DEPARTMENT_OPTIONS[0]
  );
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [titleMissing, setTitleMissing] = useState(false);

  // Populate data when editing
  useEffect(() => {
    if (initialBookingToEdit) {
      setRoomId(initialBookingToEdit.roomId);
      setTitle(initialBookingToEdit.title);
      setDescription(initialBookingToEdit.description || '');
      const s = new Date(initialBookingToEdit.startTime);
      const e = new Date(initialBookingToEdit.endTime);
      setDateStr(toBangkokDateInputValue(s));
      setStartTimeStr(toBangkokTimeInputValue(s));
      setEndTimeStr(toBangkokTimeInputValue(e));
      setAttendeesCount(initialBookingToEdit.attendeesCount);
      setDepartment(
        DEPARTMENT_OPTIONS.includes(initialBookingToEdit.department)
          ? initialBookingToEdit.department
          : DEPARTMENT_OPTIONS[0]
      );
      if (initialBookingToEdit.guestEmails && initialBookingToEdit.guestEmails.length > 0) {
        setGuestEmails(initialBookingToEdit.guestEmails);
      } else {
        setGuestEmails([]);
      }
    } else if (selectedRoomId) {
      const target = rooms.find((r) => r.id === selectedRoomId);
      setRoomId(target && !isAdmin && target.floor === 1 ? getDefaultRoomId() : selectedRoomId);
      setGuestEmails([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBookingToEdit, selectedRoomId]);

  if (!isOpen) return null;

  const currentRoom = rooms.find((r) => r.id === roomId) || rooms[0];

  // Builds the Date using the room's actual timezone (Bangkok, fixed UTC+7)
  // rather than the viewing browser's local timezone -- a booker whose
  // device isn't set to Thailand time would otherwise have "10:00" typed
  // here silently stored as 10:00 in THEIR zone, not Bangkok.
  const buildDateObject = (date: string, time: string) => {
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    return bangkokWallTimeToDate(year, month, day, hours, minutes);
  };

  const startDateTime = buildDateObject(dateStr, startTimeStr);
  const endDateTime = buildDateObject(dateStr, endTimeStr);

  const durationHours = Math.max(0, (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60));

  const resolveValidationMessage = (res: ValidationResult): string => {
    if (!res.messageKey) return t('validationGeneric');
    const params: Record<string, string | number> = {};
    Object.entries(res.messageParams || {}).forEach(([key, value]) => {
      if (value instanceof Date) {
        params[key] = key === 'maxDate' ? formatDateShort(value, language) : formatTime(value, language);
      } else {
        params[key] = value;
      }
    });
    return t(res.messageKey as any, params);
  };

  const handleValidate = (): ValidationResult => {
    return validateBookingConstraints(
      roomId,
      startDateTime,
      endDateTime,
      bookings,
      initialBookingToEdit?.id,
      isAdmin,
      attendeesCount,
      language
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setTitleMissing(true);
      setValidationResult(null);
      return;
    }
    setTitleMissing(false);

    const val = handleValidate();
    if (!val.valid) {
      setValidationResult(val);
      return;
    }

    setValidationResult(null);

    const cleanGuestEmails = guestEmails
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes('@'));

    if (initialBookingToEdit && onUpdateBooking) {
      onUpdateBooking(initialBookingToEdit.id, {
        roomId,
        title: title.trim(),
        description: description.trim(),
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        attendeesCount,
        department,
        guestEmails: cleanGuestEmails,
        updatedAt: new Date().toISOString(),
        syncGoogleCalendar: true,
      });
    } else {
      onSubmitBooking({
        roomId,
        title: title.trim(),
        description: description.trim(),
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        department,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        attendeesCount,
        guestEmails: cleanGuestEmails,
        status: 'confirmed',
        syncGoogleCalendar: true,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-100 max-h-[90dvh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#0c2417] p-4 sm:p-6 text-white flex items-center justify-between border-b border-[#18422d] shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 bg-[#1b4332] rounded-2xl text-emerald-300 shadow-md border border-emerald-500/30 shrink-0">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-extrabold text-white truncate">
                {initialBookingToEdit ? t('editTitle') : t('bookTitle')}
              </h2>
              <p className="text-xs text-emerald-200/70 truncate">
                {t('bookingModalSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-emerald-200/70 hover:text-white rounded-xl hover:bg-[#163a28] transition min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Rules Banner Info */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-950 flex items-start gap-3">
              <Info className="w-5 h-5 text-[#1b4332] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-extrabold text-[#1b4332]">{t('policyTitle')}</span>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-900">
                  <li>{t('policyEmailNotice')}</li>
                  {!isAdmin && <li>{t('policyFloor1AdminOnly')}</li>}
                </ul>
              </div>
            </div>

            {/* Validation Error Banner */}
            {(titleMissing || validationResult) && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-3 animate-shake">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{t('validationErrorTitle')}</span>
                  <p className="mt-0.5 font-medium">
                    {titleMissing ? t('meetingTitleRequired') : validationResult ? resolveValidationMessage(validationResult) : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Room Selection Grid */}
            <div>
              <label className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-2">
                1. {t('selectRoom')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rooms.map((r) => {
                  const isSelected = r.id === roomId;
                  const isLocked = r.floor === 1 && !isAdmin;
                  return (
                    <button
                      type="button"
                      key={r.id}
                      disabled={isLocked}
                      onClick={() => {
                        if (isLocked) return;
                        setRoomId(r.id);
                        setValidationResult(null);
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between min-h-[56px] ${
                        isLocked
                          ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'border-[#1b4332] bg-emerald-50/90 ring-2 ring-emerald-600/30 shadow-sm'
                          : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="font-extrabold text-slate-900 text-sm">{getRoomName(r, language)}</div>
                        <div className="text-xs text-slate-600 flex items-center gap-2 mt-0.5">
                          <span className="font-bold text-[#1b4332]">{t('floorBadge', { floor: r.floor })}</span>
                          <span>•</span>
                          <span>{t('capacity')} {r.capacity} {t('people')}</span>
                        </div>
                      </div>
                      {isLocked ? (
                        <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        isSelected && <CheckCircle2 className="w-5 h-5 text-[#1b4332] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Meeting Title & Dept */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  2. {t('meetingTitle')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('meetingTitlePlaceholder')}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setTitleMissing(false);
                  }}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('departmentTeam')}</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white min-h-[44px]"
                >
                  {DEPARTMENT_OPTIONS.map((dept) => (
                    <option key={dept} value={dept}>{getDepartmentLabel(dept, language)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('attendeesCount')}</label>
                <input
                  type="number"
                  min={1}
                  max={currentRoom.capacity}
                  value={attendeesCount}
                  onChange={(e) => {
                    setAttendeesCount(Number(e.target.value));
                    setValidationResult(null);
                  }}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                />
              </div>
            </div>

            {/* Date and Time selectors */}
            <div>
              <label className="block text-xs font-bold text-emerald-950 uppercase tracking-wider mb-2">
                3. {t('meetingDate')} & {t('startTime')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/60">
                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">{t('meetingDate')}</label>
                  <input
                    type="date"
                    required
                    value={dateStr}
                    onChange={(e) => {
                      setDateStr(e.target.value);
                      setValidationResult(null);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">{t('startTime')}</label>
                  <input
                    type="time"
                    required
                    value={startTimeStr}
                    onChange={(e) => {
                      setStartTimeStr(e.target.value);
                      setValidationResult(null);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">{t('endTime')}</label>
                  <input
                    type="time"
                    required
                    value={endTimeStr}
                    onChange={(e) => {
                      setEndTimeStr(e.target.value);
                      setValidationResult(null);
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 min-h-[44px]"
                  />
                </div>
              </div>

              {/* Time summary & duration pill */}
              <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-600 px-1 gap-1">
                <span>{t('durationLabel', { hours: durationHours.toFixed(1) })}</span>
                {durationHours > 0 && (
                  <span className="text-[#1b4332] font-extrabold">
                    {formatDateShort(startDateTime, language)} | {formatTime(startDateTime, language)} - {formatTime(endDateTime, language)}
                  </span>
                )}
              </div>

              {/* Google Calendar connection warning — shown right where the date/time
                  is being picked, not just as a toast after the booking is already
                  submitted. getGoogleAccessToken() is cleared to null the moment the
                  app detects an expired token (see App.tsx handleCreateBooking/
                  handleUpdateBooking), so a missing token here reliably covers both
                  "never connected" and "expired" cases. */}
              {!getGoogleAccessToken() && (
                <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div className="flex-1">
                    <p className="font-bold">{t('googleCalendarDisconnectedWarning')}</p>
                    <button
                      type="button"
                      onClick={onOpenAuthModal}
                      className="mt-1.5 text-[11px] font-bold text-amber-900 underline underline-offset-2 hover:text-amber-700"
                    >
                      {t('reconnectGoogleBtn')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('details')}</label>
              <textarea
                rows={2}
                placeholder={t('descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {/* Interactive Guest Invite Selector */}
            <GuestInviteSelector
              guestEmails={guestEmails}
              onChangeGuestEmails={setGuestEmails}
              currentUserEmail={currentUser.email}
            />

            {/* Google Calendar sync is always on — every user signs in with Google now,
                so there's no scenario where it should be skippable. Guests listed above
                get a native Google Calendar invite (Accept/Decline) automatically. */}
            <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">
                {t('syncGoogleCal')}
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full border border-blue-200 self-start sm:self-auto shrink-0">
                Google Workspace
              </span>
            </div>

            {/* Booker Info */}
            <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-600 flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2 min-w-0">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-6 h-6 rounded-full border border-slate-300 shrink-0"
                />
                <span className="truncate">
                  {t('bookerName')}: <strong className="text-slate-800">{currentUser.name}</strong> ({currentUser.email})
                </span>
              </div>
              {isAdmin && <span className="bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded shrink-0">{t('adminModeLabel')}</span>}
            </div>
          </div>

          {/* Submit Actions — pinned footer so it stays reachable above the mobile keyboard */}
          <div className="shrink-0 p-4 sm:p-6 pt-3 border-t border-slate-100 flex items-center gap-3 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-2xl transition min-h-[44px]"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="w-2/3 py-3 px-4 bg-[#1b4332] hover:bg-[#2d6a4f] active:scale-95 text-white font-extrabold text-sm rounded-2xl transition shadow-lg shadow-[#1b4332]/25 flex items-center justify-center gap-2 min-h-[44px]"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{initialBookingToEdit ? t('saveChanges') : t('confirmBooking')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
