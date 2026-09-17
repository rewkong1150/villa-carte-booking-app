import React, { useState } from 'react';
import { TicketCategory, TicketPriority } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { LifeBuoy, X, AlertTriangle } from 'lucide-react';

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; description: string; category: TicketCategory; priority: TicketPriority }) => void;
}

const CATEGORIES: TicketCategory[] = ['Hardware', 'Software', 'Network', 'Account', 'Other'];
const PRIORITIES: TicketPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

export const NewTicketModal: React.FC<NewTicketModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('Hardware');
  const [priority, setPriority] = useState<TicketPriority>('Medium');
  const [titleMissing, setTitleMissing] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setTitleMissing(true);
      return;
    }
    setTitleMissing(false);
    onSubmit({ title: title.trim(), description: description.trim(), category, priority });
    setTitle('');
    setDescription('');
    setCategory('Hardware');
    setPriority('Medium');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 max-h-[85dvh] flex flex-col">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30">
              <LifeBuoy className="w-5 h-5 text-blue-300" />
            </div>
            <h2 className="text-lg font-bold">{t('newTicketModalTitle')}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {titleMissing && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {t('ticketTitleRequired')}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('ticketTitleLabel')}</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('ticketTitlePlaceholder')}
                maxLength={200}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[40px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t('ticketDescriptionLabel')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('ticketDescriptionPlaceholder')}
                rows={4}
                maxLength={3000}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('ticketCategoryLabel')}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TicketCategory)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-h-[40px]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{t(`ticketCategory${c}` as any)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('ticketPriorityLabel')}</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-h-[40px]"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{t(`ticketPriority${p}` as any)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-slate-100 shrink-0">
            <button
              type="submit"
              className="w-full py-3 bg-[#1b4332] hover:bg-[#163a28] text-white font-bold text-sm rounded-xl transition shadow-md min-h-[48px]"
            >
              {t('submitTicketBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
