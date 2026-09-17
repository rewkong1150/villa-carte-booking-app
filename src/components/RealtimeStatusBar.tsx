import React from 'react';
import { Room, Booking } from '../types';
import { getRoomRealtimeStatus, getRoomName } from '../utils/bookingUtils';
import { useLanguage } from '../context/LanguageContext';

interface RealtimeStatusBarProps {
  rooms: Room[];
  bookings: Booking[];
  currentTime: Date;
  onSelectRoom?: (roomId: string) => void;
}

export const RealtimeStatusBar: React.FC<RealtimeStatusBarProps> = ({
  rooms,
  bookings,
  currentTime,
  onSelectRoom,
}) => {
  const { t, language } = useLanguage();

  return (
    <div className="p-3 sm:p-4 lg:p-6 bg-slate-50 border-b border-slate-200 shrink-0">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
        {rooms.map((room) => {
          const status = getRoomRealtimeStatus(room.id, bookings, currentTime);
          const isOccupied = status.isOccupied;
          const roomDisplayName = getRoomName(room, language);

          return (
            <div
              key={room.id}
              onClick={() => onSelectRoom && onSelectRoom(room.id)}
              className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between hover:border-blue-400 transition cursor-pointer group"
            >
              <div className="flex flex-col min-w-0 pr-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  {t('floorBadge', { floor: room.floor })}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition">
                  {roomDisplayName}
                </span>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                {isOccupied ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-500 ring-4 ring-rose-50 animate-pulse"></span>
                    <span className="text-[10px] sm:text-xs font-bold text-rose-600 uppercase">{t('statusInUse')}</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-50"></span>
                    <span className="text-[10px] sm:text-xs font-bold text-emerald-600 uppercase">{t('statusVacantShort')}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
