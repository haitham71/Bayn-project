import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  updateProfile,
  requestPasswordChange as requestPasswordChangeApi,
} from '@/features/identity/services/authService';
import { useProfile, profileQueryKey } from '@/shared/hooks/useProfile';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Input from '@/shared/components/Input';
import Button from '@/shared/components/Button';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import PasswordStrength from '@/shared/components/PasswordStrength';
import { validateUsername, validatePassword } from '@/features/identity/utils/validation';
import Eye from '@/assets/icons/eye.svg?react';
import EyeOff from '@/assets/icons/eye-off.svg?react';
import ChevronRight from '@/assets/icons/chevron-right.svg?react';
import './settings.css';

const NAV_SECTIONS = [
  { key: 'account', labelKey: 'settings.navAccount' },
  { key: 'security', labelKey: 'settings.navSecurity' },
  { key: 'notifications', labelKey: 'settings.navNotifications' },
  { key: 'legal', labelKey: 'settings.navLegal' },
];

function eyeToggle(shown) {
  return shown
    ? <Eye width={18} height={18} aria-hidden="true" />
    : <EyeOff width={18} height={18} aria-hidden="true" />;
}

export default function SettingsPage({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState('account');
  const [confirmState, setConfirmState] = useState(null);

  // ---- Account info (username editable; email/phone read-only) ----
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [accountErrors, setAccountErrors] = useState({});
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');

  // ---- Password ----
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwErrors, setPwErrors] = useState({});
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSubmitError, setPwSubmitError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // ---- Notifications (UI-only — no backend endpoint documented yet) ----
  const [notifJoinRequests, setNotifJoinRequests] = useState(true);
  const [notifMeetingReminders, setNotifMeetingReminders] = useState(true);
  const [notifContractUpdates, setNotifContractUpdates] = useState(true);
  const [notifChatMessages, setNotifChatMessages] = useState(false);

  // Seed the account fields from the cached profile once it loads.
  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username || '');
    setEmail(profile.email || '');
    setPhone(profile.phone_number ? `+966 ${profile.phone_number}` : '');
  }, [profile]);

  // ---- Account info save (username only; email/phone are read-only) ----
  function requestAccountSave() {
    const err = validateUsername(username);
    setAccountErrors(err ? { username: err } : {});
    if (err) return;
    if (username.trim() === (profile?.username || '')) {
      setAccountError(t('myProfile.noChanges'));
      return;
    }
    setAccountError('');
    setConfirmState({ message: t('myProfile.confirmAccountMsg'), onConfirm: doAccountSave });
  }
  async function doAccountSave() {
    setAccountSaving(true);
    setAccountError('');
    try {
      const updated = await updateProfile({ username });
      queryClient.setQueryData(profileQueryKey, updated);
    } catch (e) {
      setAccountError(getApiErrorMessage(e, t('signup.errorGeneric')));
    } finally {
      setAccountSaving(false);
    }
  }
  const accountFieldError = (field) =>
    accountErrors[field] ? { error: true, errorText: t(`signup.${accountErrors[field]}`) } : {};

  // ---- Password save ----
  function requestPasswordSave() {
    const next = {};
    if (!currentPassword) next.current = 'errRequired';
    const pass = validatePassword(newPassword);
    if (pass) next.new = pass;
    else if (newPassword === currentPassword) next.new = 'errSamePassword';
    if (!next.new && confirmNewPassword !== newPassword) next.confirm = 'errorPassword';
    setPwErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setPwSubmitError('');
    setPwSuccess('');
    setConfirmState({ message: t('myProfile.confirmPasswordMsg'), onConfirm: doPasswordSave });
  }
  async function doPasswordSave() {
    setPwSaving(true);
    setPwSubmitError('');
    try {
      await requestPasswordChangeApi(currentPassword, newPassword);
      setPwSuccess(t('myProfile.passwordEmailSent'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (e) {
      setPwSubmitError(getApiErrorMessage(e, t('signup.errorGeneric')));
    } finally {
      setPwSaving(false);
    }
  }
  function clearPwError(field) {
    setPwErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }
  const pwFieldError = (field) =>
    pwErrors[field] ? { error: true, errorText: t(`signup.${pwErrors[field]}`) } : {};

  function handleConfirm() {
    const action = confirmState?.onConfirm;
    setConfirmState(null);
    action?.();
  }

  const memberSince = profile?.created_at
    ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(profile.created_at))
    : '';

  function scrollTo(key) {
    setActiveSection(key);
    document.getElementById(`settings-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="st bayn-scroll">
      <Sidebar activeKey="settings" onNavigate={onNavigate} />

      <div className="st__main">
        <Navbar userName={profile ? `${profile.first_name_en || ''} ${profile.last_name_en || ''}`.trim() : ''} />

        <div className="st__head">
          <div>
            <h1>{t('settings.title')}</h1>
            <p className="st__subtitle">{t('settings.subtitle')}</p>
          </div>
          {memberSince && (
            <p className="st__member-since">{t('profileView.memberSince')}: <span>{memberSince}</span></p>
          )}
        </div>

        <div className="st__body">
          <nav className="st__nav" aria-label={t('settings.title')}>
            {NAV_SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`st__nav-item${activeSection === s.key ? ' st__nav-item--active' : ''}`}
                onClick={() => scrollTo(s.key)}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </nav>

          <div className="st__content">

            {/* ---- Account info: username (editable) + email/phone (read-only) ---- */}
            <section id="settings-account" className="st__panel">
              <div className="st__panel-head">
                <h3>{t('settings.accountTitle')}</h3>
                <p className="st__panel-desc">{t('settings.accountDesc')}</p>
              </div>

              <div className="st__row2">
                <Input
                  label={t('signup.username')}
                  value={username}
                  dir="ltr"
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setAccountErrors((p) => (p.username ? {} : p));
                    setAccountError('');
                  }}
                  {...accountFieldError('username')}
                />
                <Input label={t('signup.email')} value={email} dir="ltr" disabled />
              </div>
              <div className="st__row2">
                <Input label={t('signup.phone')} value={phone} dir="ltr" disabled />
              </div>
              {accountError && <p className="st__error">{accountError}</p>}
              <div className="st__save-row">
                <Button variant="primary" size="sm" onClick={requestAccountSave} disabled={accountSaving}>{t('myProfile.save')}</Button>
              </div>
            </section>

            <section id="settings-security" className="st__panel">
              <div className="st__panel-head">
                <h3>{t('myProfile.changePassword')}</h3>
                <p className="st__panel-desc">{t('settings.passwordDesc')}</p>
              </div>
              <div className="st__row2">
                <Input
                  label={t('myProfile.currentPassword')} type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); clearPwError('current'); }}
                  trailingIcon={eyeToggle(showCurrent)} onTrailingClick={() => setShowCurrent((s) => !s)}
                  {...pwFieldError('current')}
                />
                <Input
                  label={t('myProfile.newPassword')} type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); clearPwError('new'); }}
                  trailingIcon={eyeToggle(showNew)} onTrailingClick={() => setShowNew((s) => !s)}
                  {...pwFieldError('new')}
                />
              </div>
              <div className="st__row2">
                <Input
                  label={t('myProfile.confirmNewPassword')} type={showConfirm ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => { setConfirmNewPassword(e.target.value); clearPwError('confirm'); }}
                  trailingIcon={eyeToggle(showConfirm)} onTrailingClick={() => setShowConfirm((s) => !s)}
                  {...pwFieldError('confirm')}
                />
              </div>
              <PasswordStrength password={newPassword} />
              {pwSubmitError && <p className="st__error">{pwSubmitError}</p>}
              {pwSuccess && <p className="st__hint">{pwSuccess}</p>}
              <div className="st__save-row">
                <Button variant="primary" size="sm" onClick={requestPasswordSave} disabled={pwSaving}>{t('myProfile.changePassword')}</Button>
              </div>
            </section>

            {/* ---- Notifications ---- */}
            <section id="settings-notifications" className="st__panel">
              <div className="st__panel-head">
                <h3>{t('settings.notifTitle')}</h3>
                <p className="st__panel-desc">{t('settings.notifDesc')}</p>
              </div>
              {[
                { label: t('settings.notifJoinRequests'), sub: t('settings.notifJoinRequestsSub'), val: notifJoinRequests, set: setNotifJoinRequests },
                { label: t('settings.notifMeetings'), sub: t('settings.notifMeetingsSub'), val: notifMeetingReminders, set: setNotifMeetingReminders },
                { label: t('settings.notifContracts'), sub: t('settings.notifContractsSub'), val: notifContractUpdates, set: setNotifContractUpdates },
                { label: t('settings.notifChat'), sub: t('settings.notifChatSub'), val: notifChatMessages, set: setNotifChatMessages },
              ].map((n) => (
                <div className="st__toggle-row" key={n.label}>
                  <div>
                    <p className="st__toggle-label">{n.label}</p>
                    <p className="st__toggle-sub">{n.sub}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={n.val}
                    className={`st__toggle${n.val ? ' st__toggle--on' : ''}`}
                    onClick={() => n.set((v) => !v)}
                  >
                    <span className="st__toggle-knob" />
                  </button>
                </div>
              ))}
              <p className="st__hint">{t('settings.notifNotWired')}</p>
            </section>

            {/* ---- Legal: privacy policy + user agreement ---- */}
            <section id="settings-legal" className="st__panel">
              <div className="st__panel-head">
                <h3>{t('settings.legalTitle')}</h3>
                <p className="st__panel-desc">{t('settings.legalDesc')}</p>
              </div>
              <a className="st__legal-row" href="/privacy-policy" target="_blank" rel="noreferrer">
                <span className="st__legal-name">{t('settings.privacyPolicy')}</span>
                <ChevronRight className="st__legal-arrow" width={18} height={18} aria-hidden="true" />
              </a>
              <a className="st__legal-row" href="/user-agreement" target="_blank" rel="noreferrer">
                <span className="st__legal-name">{t('settings.userAgreement')}</span>
                <ChevronRight className="st__legal-arrow" width={18} height={18} aria-hidden="true" />
              </a>
            </section>

          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={t('myProfile.confirmTitle')}
        message={confirmState?.message}
        confirmLabel={t('myProfile.confirmYes')}
        cancelLabel={t('myProfile.confirmCancel')}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
