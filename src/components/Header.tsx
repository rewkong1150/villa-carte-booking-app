import React from 'react';
import { User, EmailNotification } from '../types';
import { getGoogleAccessToken } from '../services/googleCalendarService';
import { useLanguage } from '../context/LanguageContext';
import {
  Plus,
  Bell,
  ShieldCheck,
  Settings,
  LogOut,
} from 'lucide-react';

interface HeaderProps {
  currentUser: User;
  onOpenAuthModal: () => void;
  onOpenBookingModal: () => void;
  onOpenEmailDrawer: () => void;
  onLogout: () => void;
  emailNotifications: EmailNotification[];
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenAuthModal,
  onOpenBookingModal,
  onOpenEmailDrawer,
  onLogout,
  emailNotifications,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const isAdmin = currentUser.role === 'admin';
  const unreadEmailCount = emailNotifications.filter((n) => !n.read).length;

  return (
    <header className="h-16 bg-white border-b border-emerald-900/10 flex items-center justify-between px-3 sm:px-6 lg:px-8 flex-shrink-0 z-30 shadow-2xs">
      {/* Title & Connection Badge */}
      <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
        {/* Mobile Logo Branding */}
        <div className="lg:hidden flex items-center space-x-2 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#1b4332] flex items-center justify-center text-white font-black text-xs shadow-sm border border-emerald-600/30">
            VC
          </div>
        </div>

        <div className="min-w-0">
          <h2 className="font-extrabold text-sm sm:text-lg text-emerald-950 tracking-tight truncate">{t('consoleTitle')}</h2>
          <p className="text-[10px] sm:text-xs text-emerald-800/60 hidden sm:block font-medium truncate">{t('subtitle')}</p>
        </div>

        {!!getGoogleAccessToken() && (
          <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] bg-emerald-50 text-emerald-900 px-2.5 py-1 rounded-lg font-bold border border-emerald-200/80 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            {t('connectedGoogle')}
          </span>
        )}

        {/* Signed-in status — the Sidebar's profile card already shows this on
            desktop (lg:), but the Sidebar is hidden below that breakpoint, so
            mobile/tablet users had no visible confirmation they were signed
            in anywhere in the UI. */}
        <div
          className="lg:hidden flex items-center gap-1.5 shrink-0 min-w-0"
          title={t('signedInAsToast', { name: currentUser.name, email: currentUser.email })}
        >
          <div className="relative shrink-0">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover border border-emerald-200"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
                {currentUser.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white animate-pulse"></span>
          </div>
          <span className="hidden sm:inline text-[11px] font-bold text-emerald-950 truncate max-w-[100px]">
            {currentUser.name}
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
        {/* Language Switcher (Thai / English / Russian) */}
        <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-inner">
          <button
            onClick={() => setLanguage('th')}
            className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-all min-h-[32px] ${
              language === 'th'
                ? 'bg-white text-emerald-900 shadow-sm font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="ภาษาไทย"
          >
            <span>🇹🇭</span>
            <span className="hidden lg:inline">TH</span>
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-all min-h-[32px] ${
              language === 'en'
                ? 'bg-white text-emerald-900 shadow-sm font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="English"
          >
            <span>🇬🇧</span>
            <span className="hidden lg:inline">EN</span>
          </button>
          <button
            onClick={() => setLanguage('ru')}
            className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-all min-h-[32px] ${
              language === 'ru'
                ? 'bg-white text-emerald-900 shadow-sm font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Русский язык"
          >
            <span>🇷🇺</span>
            <span className="hidden lg:inline">RU</span>
          </button>
        </div>

        {/* Email Notifications */}
        <button
          onClick={onOpenEmailDrawer}
          className="relative p-2.5 text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50 rounded-xl transition min-w-[40px] min-h-[40px] flex items-center justify-center"
          title={t('emailNotifications')}
        >
          <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
          {unreadEmailCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white"></span>
          )}
        </button>

        {isAdmin && (
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-extrabold px-2 py-1 rounded-md">
            <ShieldCheck className="w-3 h-3" />
            {t('adminActive')}
          </span>
        )}

        {/* Divider */}
        <div className="hidden sm:block h-6 w-[1px] bg-emerald-900/10"></div>

        {/* Primary Action: Book a Room */}
        <button
          onClick={onOpenBookingModal}
          className="bg-[#1b4332] hover:bg-[#2d6a4f] active:scale-95 text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-[#1b4332]/20 flex items-center gap-1.5 min-h-[40px]"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">{t('bookRoomBtn')}</span>
          <span className="sm:hidden">{t('bookShort')}</span>
        </button>

        {/* Settings / Google Auth Button */}
        <button
          onClick={onOpenAuthModal}
          className="p-2.5 text-slate-500 hover:text-emerald-900 hover:bg-emerald-50 rounded-xl transition min-w-[40px] min-h-[40px] flex items-center justify-center"
          title={t('accountSettings')}
        >
          <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="p-2.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition min-w-[40px] min-h-[40px] flex items-center justify-center"
          title={t('logoutBtn')}
        >
          <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </header>
  );
};
