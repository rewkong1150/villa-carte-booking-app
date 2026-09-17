import React, { useState } from 'react';
import { User } from '../types';
import { ADMIN_EMAIL } from '../data/initialData';
import { DEPARTMENT_OPTIONS, getDepartmentLabel } from '../data/departments';
import { isAdminUser } from '../utils/bookingUtils';
import { pb, ADMIN_GOOGLE_OAUTH_SCOPES } from '../pocketbase/config';
import { getGoogleAccessToken, setGoogleAccessToken } from '../services/googleCalendarService';
import { useLanguage } from '../context/LanguageContext';
import { ShieldCheck, Lock, Building2, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: User) => void;
  /** When true, renders as a mandatory full-page sign-in gate (no close button) */
  hideCloseButton?: boolean;
  /** Pre-select the department dropdown — used when re-opening this modal for an
   * already-known signed-in user (e.g. reconnecting Google Calendar access) so it
   * doesn't silently reset their remembered department back to the first option. */
  defaultDepartment?: string;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
  hideCloseButton = false,
  defaultDepartment,
}) => {
  const { t, language } = useLanguage();
  // If we already know the user's department (passed in because they're
  // reconnecting an expired Google Calendar token, not signing in fresh),
  // don't ask again — this modal pops up every time the Calendar access
  // token expires (~hourly), so re-asking for department here made login
  // look like it was nagging for department on every single reconnect.
  const isReconnect = !!defaultDepartment;
  // When this modal is opened for someone already signed in (isReconnect),
  // check whether a Google Calendar token is actually present right now —
  // previously this modal always showed a "reconnect" sign-in button
  // regardless of connection state, making it look like a fresh login was
  // needed even when nothing was wrong. Only the forced first-time sign-in
  // gate (isReconnect === false) always needs the real sign-in button.
  const isAlreadyConnected = isReconnect && !!getGoogleAccessToken();
  const [customDept, setCustomDept] = useState(
    defaultDepartment && DEPARTMENT_OPTIONS.includes(defaultDepartment) ? defaultDepartment : DEPARTMENT_OPTIONS[0]
  );
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Google OAuth2 via PocketBase (opens a popup, handles the redirect callback itself).
  // This is the ONLY sign-in path — self-service email/password signup is disabled so
  // access is limited to whoever can authenticate with an @villacartegroup.com Google account.
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setAuthError('');
    try {
      const authData = await pb.collection('users').authWithOAuth2({
        provider: 'google',
        scopes: ADMIN_GOOGLE_OAUTH_SCOPES,
      });

      if (authData.meta?.accessToken) {
        setGoogleAccessToken(authData.meta.accessToken);
      }

      const email = authData.record.email || authData.meta?.email || '';
      const name = authData.meta?.name || authData.record.name || email.split('@')[0];
      const avatar = authData.meta?.avatarURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`;
      const isAdmin = isAdminUser(email, authData.record.isAppAdmin as boolean | undefined);

      const newUser: User = {
        id: authData.record.id,
        name,
        email,
        department: customDept,
        avatar,
        role: isAdmin ? 'admin' : 'user',
        isITStaff: !!authData.record.isITStaff,
      };

      onSelectUser(newUser);
      onClose();
    } catch (err: any) {
      console.error('PocketBase Google Auth error:', err);
      if (err?.isAbort) {
        // user closed the OAuth popup — not a real error, stay quiet
      } else {
        setAuthError(t('errorGoogleGeneric', { msg: err?.message || '' }));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-6 text-white relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30">
                <Building2 className="w-6 h-6 text-blue-300" />
              </div>
              <span className="font-semibold tracking-wide text-xs uppercase text-blue-300">
                {t('ssoSubtitle')}
              </span>
            </div>
            {!hideCloseButton && (
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <h2 className="text-xl font-bold">
            {isAlreadyConnected ? t('ssoConnectedTitle') : isReconnect ? t('ssoReconnectTitle') : t('ssoTitle')}
          </h2>
          <p className="text-slate-300 text-xs mt-1">
            {isAlreadyConnected ? t('ssoConnectedDesc') : isReconnect ? t('ssoReconnectDesc') : t('ssoDesc')}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {isAlreadyConnected ? (
            /* Already connected — show status, not a login button. Previously
               this modal always presented a "sign in with Google" button here
               regardless of whether the connection was actually still valid,
               which made it look like a fresh login was required every time
               someone opened Account Settings. */
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-emerald-900 text-sm">{t('googleCalendarConnectedStatus')}</p>
                <p className="text-xs text-emerald-700 mt-0.5">{t('googleCalendarConnectedDetail')}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Department Selector — only shown on a genuine fresh sign-in, not a token reconnect */}
              {!isReconnect && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{t('departmentLabel')}</label>
                  <select
                    value={customDept}
                    onChange={(e) => setCustomDept(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-h-[40px]"
                  >
                    {DEPARTMENT_OPTIONS.map((dept) => (
                      <option key={dept} value={dept}>{getDepartmentLabel(dept, language)}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sign In: Google only */}
              <div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold rounded-xl text-sm transition shadow-sm flex items-center justify-center gap-3 group active:scale-[0.99] min-h-[48px]"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.39 7.37 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.42l4.04-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.61 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>
                    {loading ? t('connectingLabel') : isReconnect ? t('reconnectGoogleBtn') : t('loginGoogleBtn')}
                  </span>
                </button>
              </div>

              {authError && (
                <p className="text-xs text-rose-600 flex items-center gap-1 font-medium bg-rose-50 p-2 rounded-lg border border-rose-200">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {authError}
                </p>
              )}
            </>
          )}
        </div>

        <div className="bg-slate-50 p-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-emerald-600" /> {t('ssoFooterAuth')}
          </span>
          <span className="text-amber-800 font-bold flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> {t('adminEmailLabel')}: {ADMIN_EMAIL}
          </span>
        </div>
      </div>
    </div>
  );
};
