import React from 'react';
import { Room, Booking } from '../types';
import { getRoomRealtimeStatus, formatTime, getRoomName } from '../utils/bookingUtils';
import { getDepartmentLabel } from '../data/departments';
import { useLanguage } from '../context/LanguageContext';
import { Users, Clock, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';

interface RoomStatusCardProps {
  room: Room;
  bookings: Booking[];
  currentTime: Date;
  onBookRoom: (roomId: Room['id']) => void;
  onViewSchedule: (roomId: Room['id']) => void;
}

export const RoomStatusCard: React.FC<RoomStatusCardProps> = ({
  room,
  bookings,
  currentTime,
  onBookRoom,
  onViewSchedule,
}) => {
  const { t, language } = useLanguage();
  const status = getRoomRealtimeStatus(room.id, bookings, currentTime);
  const isOccupied = status.isOccupied;
  const currentBk = status.currentBooking;
  const nextBk = status.nextBooking;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col group">
      {/* Image & Real-Time Status Banner */}
      <div className="relative h-40 sm:h-48 lg:h-56 overflow-hidden bg-slate-900">
        <img
          src={room.imageUrl}
          alt={getRoomName(room, language)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />

        {/* Floor badge */}
        <span className="absolute top-3 left-3 px-2.5 py-1 bg-slate-900/80 backdrop-blur-md text-slate-200 text-xs font-semibold rounded-lg border border-white/10">
          {t('floorBadge', { floor: room.floor })}
        </span>

        {/* Real-time Status Badge */}
        <div className="absolute top-3 right-3">
          {isOccupied ? (
            <span className="px-3 py-1.5 bg-rose-500/90 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 backdrop-blur-md animate-pulse">
              <span className="w-2 h-2 rounded-full bg-white"></span>
              {t('statusOccupiedBadge')}
            </span>
          ) : (
            <span className="px-3 py-1.5 bg-emerald-500/90 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-white"></span>
              {t('statusVacantBadge')}
            </span>
          )}
        </div>

        {/* Room Title on Image */}
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <h3 className="text-lg font-bold tracking-tight text-white drop-shadow-md truncate">{getRoomName(room, language)}</h3>
          <p className="text-xs text-emerald-200 font-medium flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-emerald-300 shrink-0" /> {t('maxCapacityLabel', { count: room.capacity })}
          </p>
        </div>
      </div>

      {/* Content & Amenities */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">{room.description}</p>

          {/* Amenities tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {room.amenities.map((item, idx) => (
              <span
                key={idx}
                className="px-2.5 py-1 bg-emerald-50 text-emerald-900 text-[11px] font-medium rounded-md border border-emerald-200/60"
              >
                {item}
              </span>
            ))}
          </div>

          {/* Dynamic Occupancy Status Banner */}
          <div className="rounded-xl border-0 transition-colors">
            {isOccupied && currentBk ? (
              <div className="bg-rose-50/80 border border-rose-200/80 rounded-lg p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-rose-900 gap-2">
                  <span className="flex items-center gap-1 min-w-0">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="truncate">{t('occupiedNowLabel')}</span>
                  </span>
                  <span className="text-[11px] bg-rose-200/70 text-rose-800 px-2 py-0.5 rounded font-mono font-bold shrink-0">
                    {t('untilLabel', { time: formatTime(new Date(currentBk.endTime), language) })}
                  </span>
                </div>
                <div className="font-bold text-slate-800 text-sm truncate">{currentBk.title}</div>
                <div className="text-slate-600 flex items-center justify-between text-[11px] gap-2">
                  <span className="truncate">{t('bookedByLabel', { name: currentBk.userName })}</span>
                  <span className="shrink-0">({getDepartmentLabel(currentBk.department, language)})</span>
                </div>
              </div>
            ) : nextBk ? (
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-lg p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-amber-900 gap-2">
                  <span className="flex items-center gap-1 min-w-0">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="truncate">{t('upcomingTodayLabel')}</span>
                  </span>
                  <span className="text-[11px] bg-amber-200/70 text-amber-800 px-2 py-0.5 rounded font-mono font-bold shrink-0">
                    {formatTime(new Date(nextBk.startTime), language)} - {formatTime(new Date(nextBk.endTime), language)}
                  </span>
                </div>
                <div className="font-medium text-slate-800 truncate">{nextBk.title}</div>
                <div className="text-slate-500 text-[11px] truncate">{t('byLabel', { name: nextBk.userName })}</div>
              </div>
            ) : (
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-emerald-900 font-medium">
                <span className="flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  {t('availableAllDayLabel')}
                </span>
                <span className="text-[11px] text-emerald-800 font-extrabold bg-emerald-100/80 px-2 py-0.5 rounded self-start sm:self-auto">{t('bookNowBadge')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 flex items-center gap-2">
          <button
            onClick={() => onBookRoom(room.id)}
            className="flex-1 py-3 px-4 bg-[#1b4332] hover:bg-[#2d6a4f] active:scale-95 text-white text-xs font-extrabold rounded-xl transition shadow-md shadow-[#1b4332]/20 flex items-center justify-center gap-1.5 min-h-[44px]"
          >
            <span>{t('bookThisRoom')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onViewSchedule(room.id)}
            className="py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition border border-slate-200 min-h-[44px]"
            title={t('viewScheduleBtn')}
          >
            {t('viewScheduleBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};
