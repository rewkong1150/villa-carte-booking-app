import React, { useState } from 'react';
import { Booking, Room, User } from '../types';
import { canUserModifyBooking, formatDateShort, formatTime, formatDurationHours, getRoomName } from '../utils/bookingUtils';
import { useLanguage } from '../context/LanguageContext';
import { ListOrdered, Calendar, Clock, Trash2, Edit, AlertCircle, CheckCircle2, XCircle, ShieldCheck, UserCheck } from 'lucide-react';

interface MyBookingsProps {
  bookings: Booking[];
  rooms: Room[];
  currentUser: User;
  onCancelBooking: (bookingId: string) => void;
  onEditBooking: (booking: Booking) => void;
}

export const MyBookings: React.FC<MyBookingsProps> = ({
  bookings,
  rooms,
  currentUser,
  onCancelBooking,
  onEditBooking,
}) => {
  const { t, language } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<'upcoming' | 'past' | 'cancelled'>('upcoming');
  const [cancelModalBooking, setCancelModalBooking] = useState<Booking | null>(null);

  const isAdmin = currentUser.role === 'admin';

  // Filter bookings:
  // If normal user: show user's bookings.
  // If admin: show user's bookings (with toggle option if admin wants to see theirs).
  const myAllBookings = bookings.filter((b) => {
    return b.userEmail.toLowerCase() === currentUser.email.toLowerCase() || isAdmin;
  });

  const now = new Date();

  const upcomingBookings = myAllBookings.filter(
    (b) => b.status === 'confirmed' && new Date(b.endTime) >= now
  );

  const pastBookings = myAllBookings.filter(
    (b) => b.status === 'confirmed' && new Date(b.endTime) < now
  );

  const cancelledBookings = myAllBookings.filter((b) => b.status === 'cancelled');

  const getDisplayedList = () => {
    switch (activeSubTab) {
      case 'upcoming':
        return upcomingBookings;
      case 'past':
        return pastBookings;
      case 'cancelled':
        return cancelledBookings;
      default:
        return upcomingBookings;
    }
  };

  const displayedList = getDisplayedList();

  const handleConfirmCancel = () => {
    if (cancelModalBooking) {
      onCancelBooking(cancelModalBooking.id);
      setCancelModalBooking(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-emerald-900/10 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-50 text-[#1b4332] rounded-2xl border border-emerald-200">
              <ListOrdered className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-emerald-950">{t('myBookingsTitle')}</h1>
              <p className="text-xs text-slate-500">
                {t('account')}: <strong className="text-slate-800">{currentUser.name}</strong> ({currentUser.email})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3.5 py-2 rounded-xl font-medium">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{t('policyNote')}</span>
          </div>
        </div>

        {/* Filter Sub-Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-100 pt-2 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('upcoming')}
            className={`px-4 py-2.5 font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === 'upcoming'
                ? 'border-[#1b4332] text-[#1b4332]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>{t('upcomingTab')}</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-full text-[10px] font-extrabold">
              {upcomingBookings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('past')}
            className={`px-4 py-2.5 font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === 'past'
                ? 'border-[#1b4332] text-[#1b4332]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>{t('pastTab')}</span>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10px]">
              {pastBookings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('cancelled')}
            className={`px-4 py-2.5 font-bold transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
              activeSubTab === 'cancelled'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>{t('cancelledTab')}</span>
            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full text-[10px]">
              {cancelledBookings.length}
            </span>
          </button>
        </div>
      </div>

      {/* Bookings List Cards */}
      {displayedList.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-sm space-y-3">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">{t('noBookingsFound')}</h3>
          <p className="text-xs text-slate-400">{t('startBookingHint')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedList.map((bk) => {
            const room = rooms.find((r) => r.id === bk.roomId);
            const canModify = canUserModifyBooking(bk, currentUser);
            const isOwner = bk.userEmail.toLowerCase() === currentUser.email.toLowerCase();
            const start = new Date(bk.startTime);
            const end = new Date(bk.endTime);
            const hours = formatDurationHours(bk.startTime, bk.endTime);

            return (
              <div
                key={bk.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 bg-emerald-50 text-[#1b4332] border border-emerald-200 font-extrabold text-xs rounded-lg">
                      {room ? getRoomName(room, language) : bk.roomId} ({t('floorBadge', { floor: room?.floor })})
                    </span>
                    {bk.status === 'confirmed' ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-extrabold text-[10px] rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {t('confirmedStatus')}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold text-[10px] rounded-full flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> {t('cancelledStatus')}
                      </span>
                    )}

                    {bk.googleCalendarEventId && (
                      <a
                        href={bk.googleCalendarEventLink || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-bold text-[10px] rounded-full flex items-center gap-1 transition"
                      >
                        <Calendar className="w-3 h-3 text-blue-600" /> {t('syncedGoogleCal')} ↗
                      </a>
                    )}
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900">{bk.title}</h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#1b4332]" />
                      {formatDateShort(start, language)}
                    </span>
                    <span className="flex items-center gap-1 font-mono font-bold text-slate-800">
                      <Clock className="w-3.5 h-3.5 text-[#1b4332]" />
                      {formatTime(start, language)} - {formatTime(end, language)} ({hours} {t('hoursUnit')})
                    </span>
                    <span>{t('attendeesCount')}: {bk.attendeesCount} {t('people')}</span>
                    {isAdmin && !isOwner && (
                      <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded font-bold">
                        {t('bookedByPrefix', { name: bk.userName })}
                      </span>
                    )}
                  </div>

                  {bk.guestEmails && bk.guestEmails.length > 0 && (
                    <div className="text-xs text-slate-600 bg-emerald-50/70 p-2 rounded-lg border border-emerald-100">
                      <span className="font-bold text-[#1b4332]">{t('invitedGuestsLabel')}:</span>{' '}
                      {bk.guestEmails.join(', ')}
                    </div>
                  )}

                  {bk.description && (
                    <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {bk.description}
                    </p>
                  )}
                </div>

                {/* Actions: Only owner or admin can modify/cancel */}
                <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                  {canModify && bk.status === 'confirmed' ? (
                    <>
                      <button
                        onClick={() => onEditBooking(bk)}
                        className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>{t('edit')}</span>
                      </button>

                      <button
                        onClick={() => setCancelModalBooking(bk)}
                        className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t('cancelBooking')}</span>
                      </button>
                    </>
                  ) : !canModify && bk.status === 'confirmed' ? (
                    <span className="text-[11px] text-slate-400 italic">
                      ({bk.userName})
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">{t('confirmCancelTitle')}</h3>
              <p className="text-xs text-slate-500">
                "{cancelModalBooking.title}"
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 space-y-1">
              <div>
                {t('dateLabel')}: {formatDateShort(new Date(cancelModalBooking.startTime), language)}
              </div>
              <div>
                {t('timeLabel')}: {formatTime(new Date(cancelModalBooking.startTime), language)} - {formatTime(new Date(cancelModalBooking.endTime), language)}
              </div>
              <p className="text-rose-600 font-medium text-[11px] pt-1">
                {t('cancelNotice')}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setCancelModalBooking(null)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleConfirmCancel}
                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shadow-md shadow-rose-500/20"
              >
                {t('confirmCancelBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
