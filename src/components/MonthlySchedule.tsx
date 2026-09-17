import React, { useState } from 'react';
import { Room, Booking } from '../types';
import {
  formatDateShort,
  formatTime,
  getRoomName,
  getRoomShortLabel,
  MONTH_NAMES,
  DAY_NAMES_SHORT,
  toBangkokParts,
  toBangkokDateInputValue,
  bangkokWallTimeToDate,
} from '../utils/bookingUtils';
import { getDepartmentLabel } from '../data/departments';
import { useLanguage } from '../context/LanguageContext';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, Clock, CheckCircle2 } from 'lucide-react';

interface MonthlyScheduleProps {
  rooms: Room[];
  bookings: Booking[];
  onSelectSlotToBook: (roomId: Room['id'], dateIso: string) => void;
  onSelectBookingToView: (booking: Booking) => void;
  /** Pre-select a room's filter chip, e.g. when arriving here via "View Schedule" on a specific room card. */
  initialRoomFilter?: Room['id'];
}

// Literal Tailwind class strings per room accent color (must stay literal for the
// Tailwind JIT scanner to pick them up — dynamic `bg-${color}-50` strings won't compile).
const ROOM_BADGE_STYLES: Record<string, string> = {
  emerald: 'bg-emerald-50/90 border-l-4 border-emerald-600 text-emerald-900 hover:bg-emerald-100',
  teal: 'bg-teal-50/90 border-l-4 border-teal-600 text-teal-900 hover:bg-teal-100',
  indigo: 'bg-indigo-50/90 border-l-4 border-indigo-600 text-indigo-900 hover:bg-indigo-100',
  sky: 'bg-sky-50/90 border-l-4 border-sky-600 text-sky-900 hover:bg-sky-100',
  amber: 'bg-amber-50/90 border-l-4 border-amber-600 text-amber-900 hover:bg-amber-100',
};
const DEFAULT_BADGE_STYLE = 'bg-slate-50 border-l-4 border-slate-500 text-slate-900 hover:bg-slate-100';

export const MonthlySchedule: React.FC<MonthlyScheduleProps> = ({
  rooms,
  bookings,
  onSelectSlotToBook,
  onSelectBookingToView,
  initialRoomFilter,
}) => {
  const { t, language } = useLanguage();
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedRoomIdFilter, setSelectedRoomIdFilter] = useState<string>(initialRoomFilter || 'all');
  const [viewMode, setViewMode] = useState<'month' | 'day'>('month');
  const [selectedDayDate, setSelectedDayDate] = useState(new Date());

  // Navigate months
  const handlePrevMonth = () => {
    const d = new Date(currentMonthDate);
    d.setMonth(d.getMonth() - 1);
    setCurrentMonthDate(d);
  };

  const handleNextMonth = () => {
    const d = new Date(currentMonthDate);
    d.setMonth(d.getMonth() + 1);
    setCurrentMonthDate(d);
  };

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  // Days in month calculation
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const totalDaysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon ...

  const monthNames = MONTH_NAMES[language];
  const dayHeaders = DAY_NAMES_SHORT[language];

  // The room a quick-add booking should default to: whatever room is currently
  // filtered, or the first room when viewing "all" (user can still change it in the modal).
  const defaultRoomForQuickAdd: Room['id'] =
    (selectedRoomIdFilter !== 'all' ? (selectedRoomIdFilter as Room['id']) : rooms[0]?.id) || rooms[0]?.id;

  const filteredBookings = bookings.filter((b) => {
    if (b.status !== 'confirmed') return false;
    if (selectedRoomIdFilter !== 'all' && b.roomId !== selectedRoomIdFilter) return false;
    return true;
  });

  // Get bookings for a specific day in current month. Compares each booking's
  // Bangkok calendar day (not the viewer's own local timezone) against the
  // grid cell -- otherwise a booking near midnight could render under the
  // wrong day for anyone whose device isn't set to Thailand time.
  const getBookingsForDay = (dayNumber: number) => {
    return filteredBookings.filter((b) => {
      const parts = toBangkokParts(new Date(b.startTime));
      return parts.year === year && parts.monthIndex === month && parts.day === dayNumber;
    });
  };

  const getRoomBadgeStyle = (roomId: Room['id']) => {
    const room = rooms.find((r) => r.id === roomId);
    return (room && ROOM_BADGE_STYLES[room.color]) || DEFAULT_BADGE_STYLE;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Controls */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{t('monthlyTitle')}</h2>
              <p className="text-xs text-slate-500">
                {t('monthlyDesc')}
              </p>
            </div>
          </div>

          {/* Month Navigator Controls */}
          <div className="flex items-center space-x-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-200 self-start md:self-auto">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-xl text-slate-600 hover:bg-white hover:shadow transition min-w-[36px] min-h-[36px] flex items-center justify-center"
              title={t('prevMonth')}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold text-slate-800 min-w-[120px] sm:min-w-[140px] text-center">
              {monthNames[month]} {language === 'th' ? year + 543 : year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-xl text-slate-600 hover:bg-white hover:shadow transition min-w-[36px] min-h-[36px] flex items-center justify-center"
              title={t('nextMonth')}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter bar by Room & View Mode */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-600 shrink-0">{t('filterLabel')}</span>

            <button
              onClick={() => setSelectedRoomIdFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap min-h-[32px] ${
                selectedRoomIdFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('allRooms')}
            </button>

            {rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoomIdFilter(r.id)}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap min-h-[32px] ${
                  selectedRoomIdFilter === r.id
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {getRoomName(r, language)}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg font-bold transition min-h-[32px] ${
                viewMode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t('monthView')}
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 rounded-lg font-bold transition min-h-[32px] ${
                viewMode === 'day' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t('weekView')}
            </button>
          </div>
        </div>
      </div>

      {/* View Mode 1: Month Calendar Grid */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {/* Day Headers */}
              <div className="grid grid-cols-7 bg-slate-900 text-white text-xs font-bold text-center py-3 border-b border-slate-800">
                {dayHeaders.map((dayName, idx) => (
                  <div key={idx} className={idx === 0 || idx === 6 ? 'text-amber-400' : 'text-slate-200'}>
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 auto-rows-fr gap-px bg-slate-200">
                {/* Empty offset cells before month starts */}
                {Array.from({ length: startingDayOfWeek }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="bg-slate-50/60 min-h-[80px] sm:min-h-[100px] md:min-h-[120px] p-2 text-slate-300" />
                ))}

                {/* Days of month */}
                {Array.from({ length: totalDaysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dayBookings = getBookingsForDay(dayNum);
                  const cellDate = new Date(year, month, dayNum);
                  const nowInBangkok = toBangkokParts(new Date());
                  const isToday =
                    nowInBangkok.day === dayNum &&
                    nowInBangkok.monthIndex === month &&
                    nowInBangkok.year === year;

                  return (
                    <div
                      key={dayNum}
                      className={`bg-white min-h-[80px] sm:min-h-[100px] md:min-h-[120px] p-1.5 sm:p-2 flex flex-col justify-between hover:bg-slate-50/80 transition group ${
                        isToday ? 'ring-2 ring-indigo-500/80 bg-indigo-50/20' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-extrabold w-6 h-6 rounded-full flex items-center justify-center ${
                            isToday ? 'bg-indigo-600 text-white shadow' : 'text-slate-700'
                          }`}
                        >
                          {dayNum}
                        </span>
                        <button
                          onClick={() => onSelectSlotToBook(defaultRoomForQuickAdd, cellDate.toISOString())}
                          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-1 min-h-[28px] rounded transition"
                          title={t('quickBookTooltip')}
                        >
                          {t('quickBookBtn')}
                        </button>
                      </div>

                      {/* Day Bookings List */}
                      <div className="space-y-1.5 flex-1 overflow-y-auto max-h-[90px] sm:max-h-[110px] pr-0.5">
                        {dayBookings.length === 0 ? (
                          <div className="text-[10px] text-slate-300 italic pt-2 text-center">{t('noBookingsToday')}</div>
                        ) : (
                          dayBookings.map((bk) => {
                            const room = rooms.find((r) => r.id === bk.roomId);
                            const badgeStyle = getRoomBadgeStyle(bk.roomId);

                            return (
                              <div
                                key={bk.id}
                                onClick={() => onSelectBookingToView(bk)}
                                className={`p-1.5 rounded-lg border text-[11px] cursor-pointer hover:scale-[1.02] transition shadow-2xs ${badgeStyle}`}
                                title={`${bk.title} (${bk.userName})`}
                              >
                                <div className="font-bold truncate">{bk.title}</div>
                                <div className="text-[10px] opacity-90 flex items-center justify-between mt-0.5">
                                  <span>{formatTime(new Date(bk.startTime), language)}</span>
                                  <span className="font-semibold">{room ? getRoomShortLabel(room) : bk.roomId}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Mode 2: Daily Time Slot Timeline Grid */}
      {viewMode === 'day' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600 shrink-0" />
              {t('dayTimelineTitle', { date: formatDateShort(selectedDayDate, language) })}
            </h3>
            <input
              type="date"
              value={toBangkokDateInputValue(selectedDayDate)}
              onChange={(e) => {
                const [y, m, d] = e.target.value.split('-').map(Number);
                // Anchor at Bangkok noon, not UTC midnight -- keeps this
                // instant safely inside the intended Bangkok calendar day no
                // matter what timezone the viewer's own device is set to.
                setSelectedDayDate(bangkokWallTimeToDate(y, m, d, 12, 0));
              }}
              className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold min-h-[40px]"
            />
          </div>

          <div className="space-y-4">
            {rooms.map((room) => {
              const selectedParts = toBangkokParts(selectedDayDate);
              const roomDayBookings = filteredBookings.filter((b) => {
                const parts = toBangkokParts(new Date(b.startTime));
                return (
                  b.roomId === room.id &&
                  parts.year === selectedParts.year &&
                  parts.monthIndex === selectedParts.monthIndex &&
                  parts.day === selectedParts.day
                );
              });

              return (
                <div key={room.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-sm">{getRoomName(room, language)}</span>
                      <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                        {t('floorCapacityBadge', { floor: room.floor, capacity: room.capacity })}
                      </span>
                    </div>
                    <button
                      onClick={() => onSelectSlotToBook(room.id, selectedDayDate.toISOString())}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg transition min-h-[36px] self-start sm:self-auto"
                    >
                      {t('dayBookRoomBtn')}
                    </button>
                  </div>

                  {roomDayBookings.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">{t('noBookingsTodayAvailable')}</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                      {roomDayBookings.map((bk) => (
                        <div
                          key={bk.id}
                          onClick={() => onSelectBookingToView(bk)}
                          className="p-3 bg-white border border-indigo-200 rounded-xl text-xs shadow-2xs hover:shadow transition cursor-pointer"
                        >
                          <div className="font-bold text-slate-900">{bk.title}</div>
                          <div className="text-indigo-600 font-mono font-bold mt-1">
                            {formatTime(new Date(bk.startTime), language)} - {formatTime(new Date(bk.endTime), language)}
                          </div>
                          <div className="text-slate-500 mt-1 flex items-center justify-between text-[11px]">
                            <span>{bk.userName}</span>
                            <span>{getDepartmentLabel(bk.department, language)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
