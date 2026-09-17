import React, { useState } from 'react';
import { EmailNotification } from '../types';
import { ADMIN_EMAIL } from '../data/initialData';
import { useLanguage } from '../context/LanguageContext';
import { Mail, CheckCircle2, XCircle, Clock, Trash2, X } from 'lucide-react';

interface EmailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: EmailNotification[];
  onMarkAllAsRead: () => void;
  onClearNotifications: () => void;
}

const LOCALE_MAP: Record<string, string> = { th: 'th-TH', en: 'en-US', ru: 'ru-RU' };

export const EmailDrawer: React.FC<EmailDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onClearNotifications,
}) => {
  const { t, language } = useLanguage();
  const locale = LOCALE_MAP[language] || 'en-US';
  const [selectedNotification, setSelectedNotification] = useState<EmailNotification | null>(
    notifications[0] || null
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex sm:pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col border-l border-slate-200">
          {/* Header */}
          <div className="bg-[#0c2417] p-4 sm:p-5 text-white flex items-center justify-between border-b border-[#18422d] shrink-0">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="p-2.5 bg-[#1b4332] rounded-2xl text-emerald-300 shadow-md border border-emerald-500/30 shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-extrabold text-white truncate">{t('emailNotifications')}</h2>
                <p className="text-xs text-emerald-200/70 truncate">{t('emailDrawerSubtitle')}</p>
              </div>
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              <button
                onClick={onMarkAllAsRead}
                className="text-xs text-emerald-300 hover:text-white font-bold p-2 hover:bg-[#163a28] rounded-lg transition whitespace-nowrap"
                title={t('markAllRead')}
              >
                {t('markAllRead')}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-emerald-200/70 hover:text-white rounded-xl hover:bg-[#163a28] transition min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* List & Detailed Mail Preview Split */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {notifications.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-slate-400 space-y-2 my-auto">
                <Mail className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-sm font-bold">{t('noEmails')}</p>
                <p className="text-xs">{t('noEmailsDesc')}</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col divide-y divide-slate-100 overflow-y-auto">
                {notifications.map((item) => {
                  const isCreated = item.type === 'booking_created';
                  const isCancelled = item.type === 'booking_cancelled';

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedNotification(item)}
                      className={`p-4 cursor-pointer transition border-l-4 ${
                        selectedNotification?.id === item.id
                          ? 'bg-indigo-50/70 border-indigo-600'
                          : item.read
                          ? 'bg-white border-transparent hover:bg-slate-50'
                          : 'bg-amber-50/30 border-amber-500 font-semibold'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2 min-w-0">
                          {isCreated && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                          {isCancelled && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                          {!isCreated && !isCancelled && <Clock className="w-4 h-4 text-amber-600 shrink-0" />}

                          <span className="text-xs font-bold text-slate-900 truncate">
                            {item.subject}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                          {new Date(item.sentAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 mt-1 flex items-center justify-between gap-2">
                        <span className="truncate">{t('toLabel')}: {item.recipientEmail}</span>
                        <span className="text-[10px] text-indigo-600 font-medium shrink-0">{item.bookingDetails.roomName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Email Preview Drawer Footer */}
            {selectedNotification && (
              <div className="bg-slate-50 p-4 sm:p-5 border-t border-slate-200 max-h-[40dvh] overflow-y-auto space-y-3 shrink-0">
                <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-200 gap-2">
                  <span className="truncate">{t('fromSystemLabel')}</span>
                  <span className="whitespace-nowrap">{new Date(selectedNotification.sentAt).toLocaleString(locale)}</span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs">
                  <div className="font-bold text-sm text-slate-900">{selectedNotification.subject}</div>
                  <div
                    className="prose prose-sm text-slate-700 leading-relaxed max-w-full overflow-x-auto"
                    dangerouslySetInnerHTML={{ __html: selectedNotification.bodyHtml }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-100 p-3 text-center text-xs text-slate-500 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-1 shrink-0">
            <span className="truncate">{t('adminCopyNotice', { email: ADMIN_EMAIL })}</span>
            <button
              onClick={onClearNotifications}
              className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" /> {t('clearBtn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
