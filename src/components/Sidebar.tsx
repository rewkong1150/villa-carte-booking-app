import React from 'react';
import { User } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { NAV_ITEMS, TabKey, HELPDESK_VISIBILITY } from '../config/navigation';
import { ShieldCheck, LogOut } from 'lucide-react';

interface SidebarProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  currentUser: User;
  onOpenAuthModal: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  onOpenAuthModal,
  onLogout,
}) => {
  const { t } = useLanguage();
  const isAdmin = currentUser.role === 'admin';

  // Get initials
  const initials = currentUser.name
    ? currentUser.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'VC';

  return (
    <aside className="w-64 bg-[#0c2417] flex-shrink-0 flex flex-col text-white border-r border-[#19402b] select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-[#19402b]">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-extrabold tracking-tight text-emerald-400">
            VILLA<span className="text-white">CARTE</span>
          </h1>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold px-2 py-0.5 rounded-md">
            HQ
          </span>
        </div>
        <p className="text-[10px] uppercase tracking-widest text-emerald-200/70 mt-1 font-semibold">
          {t('brandSubtitle')}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.filter(
          (item) =>
            (item.key !== 'admin' || isAdmin) &&
            (item.key !== 'helpdesk' || HELPDESK_VISIBILITY === 'everyone' || isAdmin)
        ).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`w-full flex items-center px-4 py-3 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                isActive
                  ? 'bg-[#2d6a4f] text-white shadow-lg shadow-[#1b4332]/40 ring-1 ring-emerald-400/30'
                  : 'text-emerald-100/80 hover:bg-[#143a27] hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 mr-3 shrink-0 text-emerald-300" />
              <span className="truncate">{t(item.sidebarLabelKey)}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Profile Footer */}
      <div className="p-4 border-t border-[#19402b] mt-auto space-y-2">
        <div
          onClick={onOpenAuthModal}
          className="flex items-center space-x-3 p-2.5 bg-[#123322] hover:bg-[#18422d] rounded-xl cursor-pointer transition border border-[#1f5037]"
        >
          {currentUser.avatar ? (
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-8 h-8 rounded-full object-cover border border-emerald-400 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
              {initials}
            </div>
          )}

          <div className="overflow-hidden min-w-0 flex-1">
            <p className="text-xs font-bold truncate text-white flex items-center gap-1">
              {currentUser.name}
              {isAdmin && (
                <span className="text-[9px] bg-amber-400 text-slate-900 px-1 rounded font-black flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" /> ADM
                </span>
              )}
            </p>
            <p className="text-[10px] text-emerald-200/60 truncate">{currentUser.email}</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-200 border border-rose-500/25 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition min-h-[40px]"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{t('logoutBtn')}</span>
        </button>
      </div>
    </aside>
  );
};
