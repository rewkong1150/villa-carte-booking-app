import React, { useState, useRef, useEffect } from 'react';
import { Room, Booking } from '../types';
import { RoomStatusCard } from './RoomStatusCard';
import { getRoomRealtimeStatus, formatDate } from '../utils/bookingUtils';
import { useLanguage } from '../context/LanguageContext';
import { Building2, Layers, Video, Volume2, VolumeX, Play, Pause } from 'lucide-react';

interface FloorPlanProps {
  rooms: Room[];
  bookings: Booking[];
  currentTime: Date;
  onBookRoom: (roomId: Room['id']) => void;
  onViewSchedule: (roomId: Room['id']) => void;
}

const HERO_POSTER = 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1600&q=80';

export const FloorPlan: React.FC<FloorPlanProps> = ({
  rooms,
  bookings,
  currentTime,
  onBookRoom,
  onViewSchedule,
}) => {
  const { t, language } = useLanguage();
  const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all');
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showVideoBg, setShowVideoBg] = useState(true);
  const [isDesktopViewport, setIsDesktopViewport] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );
  const videoRef = useRef<HTMLVideoElement>(null);

  // Skip the heavy autoplay hero video on mobile/slow connections — use a static poster instead
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktopViewport(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Compute status summary
  const totalRooms = rooms.length;
  const roomStatuses = rooms.map((r) => getRoomRealtimeStatus(r.id, bookings, currentTime));
  const occupiedCount = roomStatuses.filter((s) => s.isOccupied).length;
  const vacantCount = totalRooms - occupiedCount;

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const showActualVideo = showVideoBg && isDesktopViewport;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner & Quick Overview with Clean Layan Verde Video Background */}
      <div className="bg-black rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden border border-slate-800 group">
        {/* Background Layer: real video on desktop, static poster image on mobile to save bandwidth */}
        {showVideoBg && (
          <div className="absolute inset-0 z-0 overflow-hidden">
            {showActualVideo ? (
              <video
                ref={videoRef}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                className="w-full h-full object-cover opacity-100 transition-opacity duration-700"
                poster={HERO_POSTER}
              >
                <source src="https://layanverde.com/video/index-hero-d.webm" type="video/webm" />
                <source src="https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-architecture-interior-41485-large.mp4" type="video/mp4" />
              </video>
            ) : (
              <img src={HERO_POSTER} alt="" className="w-full h-full object-cover" />
            )}
            {/* Subtle Gradient Shadow for text contrast without green tint */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/60"></div>
          </div>
        )}

        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 opacity-5 pointer-events-none text-white z-10">
          <Building2 className="w-96 h-96" />
        </div>

        <div className="relative z-20 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-emerald-400 border border-emerald-500/40 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                {t('realtimeStatus')}
              </span>
              <span className="text-xs text-white/90 drop-shadow">({formatDate(currentTime, language)})</span>

              {/* Video Controls Toolbar (desktop video mode only) */}
              {isDesktopViewport && (
                <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 text-[11px] text-white shadow-md">
                  <button
                    onClick={togglePlay}
                    className="hover:text-emerald-300 p-1 transition min-w-[24px] min-h-[24px] flex items-center justify-center"
                    title={isPlaying ? t('pauseVideo') : t('playVideo')}
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-white" />}
                  </button>
                  <button
                    onClick={toggleMute}
                    className="hover:text-emerald-300 p-1 transition min-w-[24px] min-h-[24px] flex items-center justify-center"
                    title={isMuted ? t('unmute') : t('mute')}
                  >
                    {isMuted ? <VolumeX className="w-3.5 h-3.5 text-white" /> : <Volume2 className="w-3.5 h-3.5 text-white" />}
                  </button>
                  <button
                    onClick={() => setShowVideoBg(!showVideoBg)}
                    className="hover:text-emerald-300 p-1 transition text-[11px] font-bold border-l border-white/20 pl-2 text-white"
                    title={t('toggleBgVideo')}
                  >
                    <Video className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                    {showVideoBg ? t('turnOffVideo') : t('turnOnVideo')}
                  </button>
                </div>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {t('floorPlanTitle')}
            </h1>
            <p className="text-white/90 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
              {t('floorPlanDesc')}
            </p>
          </div>

          {/* Real-time Status Counter Cards */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
            <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-2xl p-3 sm:px-4 sm:py-3 text-center shadow-xl">
              <div className="text-2xl font-black text-emerald-400 drop-shadow">{vacantCount}</div>
              <div className="text-[11px] font-bold text-white/90">{t('vacantNow')}</div>
            </div>

            <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-2xl p-3 sm:px-4 sm:py-3 text-center shadow-xl">
              <div className="text-2xl font-black text-rose-400 drop-shadow">{occupiedCount}</div>
              <div className="text-[11px] font-bold text-white/90">{t('occupiedNow')}</div>
            </div>

            <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-2xl p-3 sm:px-4 sm:py-3 text-center shadow-xl">
              <div className="text-2xl font-black text-amber-300 drop-shadow">{totalRooms}</div>
              <div className="text-[11px] font-bold text-white/90">{t('totalRoomsCount')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Floor Selector Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-900/10 pb-4">
        <div className="flex items-center space-x-2">
          <Layers className="w-5 h-5 text-emerald-800 shrink-0" />
          <h2 className="text-base sm:text-lg font-bold text-emerald-950">{t('floorSelectorLabel')}</h2>
        </div>

        <div className="flex items-center space-x-1.5 sm:space-x-2 bg-emerald-950/5 p-1.5 rounded-2xl border border-emerald-900/10 overflow-x-auto">
          <button
            onClick={() => setSelectedFloor('all')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap min-h-[36px] ${
              selectedFloor === 'all'
                ? 'bg-[#1b4332] text-white shadow-sm'
                : 'text-emerald-900 hover:text-emerald-950 hover:bg-emerald-100/60'
            }`}
          >
            {t('showAllFloorsBtn')}
          </button>
          <button
            onClick={() => setSelectedFloor(1)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap min-h-[36px] ${
              selectedFloor === 1
                ? 'bg-[#1b4332] text-white shadow-sm'
                : 'text-emerald-900 hover:text-emerald-950 hover:bg-emerald-100/60'
            }`}
          >
            {t('floor1FilterBtn')}
          </button>
          <button
            onClick={() => setSelectedFloor(2)}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap min-h-[36px] ${
              selectedFloor === 2
                ? 'bg-[#1b4332] text-white shadow-sm'
                : 'text-emerald-900 hover:text-emerald-950 hover:bg-emerald-100/60'
            }`}
          >
            {t('floor2FilterBtn')}
          </button>
        </div>
      </div>

      {/* Rooms Grid Organized by Floors */}
      <div className="space-y-10">
        {(selectedFloor === 'all' || selectedFloor === 1) && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 bg-slate-100/80 px-4 py-2.5 rounded-xl border border-slate-200/80">
              <span className="w-3 h-3 rounded-full bg-teal-500 shrink-0"></span>
              <h3 className="font-bold text-slate-800 text-base">{t('floor1Label')}</h3>
              <span className="text-xs text-slate-500">{t('floor1SectionDesc')}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {rooms
                .filter((r) => r.floor === 1)
                .map((room) => (
                  <RoomStatusCard
                    key={room.id}
                    room={room}
                    bookings={bookings}
                    currentTime={currentTime}
                    onBookRoom={onBookRoom}
                    onViewSchedule={onViewSchedule}
                  />
                ))}
            </div>
          </div>
        )}

        {(selectedFloor === 'all' || selectedFloor === 2) && (
          <div className="space-y-4">
            <div className="flex items-center space-x-3 bg-slate-100/80 px-4 py-2.5 rounded-xl border border-slate-200/80">
              <span className="w-3 h-3 rounded-full bg-indigo-600 shrink-0"></span>
              <h3 className="font-bold text-slate-800 text-base">{t('floor2Label')}</h3>
              <span className="text-xs text-slate-500">{t('floor2SectionDesc')}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {rooms
                .filter((r) => r.floor === 2)
                .map((room) => (
                  <RoomStatusCard
                    key={room.id}
                    room={room}
                    bookings={bookings}
                    currentTime={currentTime}
                    onBookRoom={onBookRoom}
                    onViewSchedule={onViewSchedule}
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
