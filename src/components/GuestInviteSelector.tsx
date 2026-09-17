import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { UserPlus, X } from 'lucide-react';

interface GuestInviteSelectorProps {
  guestEmails: string[];
  onChangeGuestEmails: (emails: string[]) => void;
  currentUserEmail?: string;
}

// Simple, reliable email format check — good enough to catch typos without
// being so strict it rejects real addresses.
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const GuestInviteSelector: React.FC<GuestInviteSelectorProps> = ({
  guestEmails,
  onChangeGuestEmails,
  currentUserEmail = '',
}) => {
  const { t } = useLanguage();
  const [emailInput, setEmailInput] = useState('');
  const [error, setError] = useState('');

  const isEmailSelected = (email: string) =>
    guestEmails.some((e) => e.toLowerCase() === email.toLowerCase());

  const handleAddEmail = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const email = emailInput.trim();
    if (!email) return;

    if (!isValidEmail(email)) {
      setError(t('invalidEmailError'));
      return;
    }
    if (email.toLowerCase() === currentUserEmail.toLowerCase()) {
      setError(t('cannotInviteSelfError'));
      return;
    }
    if (isEmailSelected(email)) {
      setError(t('emailAlreadyAddedError'));
      return;
    }

    onChangeGuestEmails([...guestEmails, email]);
    setEmailInput('');
    setError('');
  };

  const removeEmail = (emailToRemove: string) => {
    onChangeGuestEmails(guestEmails.filter((e) => e.toLowerCase() !== emailToRemove.toLowerCase()));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
          {t('inviteGuestsLabel')}
        </label>
        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          {t('invitedCount')} {guestEmails.length} {t('people')}
        </span>
      </div>

      {/* Plain email entry — type an address, press Enter or Add */}
      <div className="flex items-center gap-2">
        <input
          type="email"
          placeholder={t('searchGuestPlaceholder')}
          value={emailInput}
          onChange={(e) => {
            setEmailInput(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddEmail(e);
          }}
          className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white min-h-[44px]"
        />
        <button
          type="button"
          onClick={() => handleAddEmail()}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition min-h-[44px] shrink-0"
        >
          {t('addEmailBtn')}
        </button>
      </div>
      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

      {/* Selected Guests Tags list */}
      {guestEmails.length > 0 && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
          <div className="text-[11px] font-bold text-slate-600">{t('invitedListTitle')} ({guestEmails.length} {t('people')}):</div>
          <div className="flex flex-wrap gap-2">
            {guestEmails.map((email) => (
              <div
                key={email}
                className="bg-white border border-emerald-200/80 text-slate-800 px-2.5 py-1.5 rounded-xl shadow-sm text-xs flex items-center space-x-2 group hover:border-emerald-400 transition"
              >
                <span className="font-medium">{email}</span>
                <button
                  type="button"
                  onClick={() => removeEmail(email)}
                  className="p-0.5 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition"
                  title={t('removeGuestTitle')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
