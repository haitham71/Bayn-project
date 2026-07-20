import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getSaudiCountryId,
  getCities,
  updateProfile,
  requestPasswordChange as requestPasswordChangeApi,
  sendEmailOtp,
  sendPhoneOtp,
  deleteAccount,
} from '@/features/identity/services/authService';
import { useProfile, profileQueryKey } from '@/shared/hooks/useProfile';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Input from '@/shared/components/Input';
import Select from '@/shared/components/Select';
import Button from '@/shared/components/Button';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import { validateName, validateUsername, validatePassword } from '@/features/identity/utils/validation';
import Eye from '@/assets/icons/eye.svg?react';
import EyeOff from '@/assets/icons/eye-off.svg?react';
import Calendar from '@/assets/icons/calendar.svg?react';
import LinkIcon from '@/assets/icons/link.svg?react';
import './settings.css';

const NAV_SECTIONS = [
  { key: 'account', labelKey: 'settings.navAccount' },
  { key: 'security', labelKey: 'settings.navSecurity' },
  { key: 'notifications', labelKey: 'settings.navNotifications' },
  { key: 'connected', labelKey: 'settings.navConnected' },
  { key: 'danger', labelKey: 'settings.navDanger' },
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

  // ---- Name (Account) ----
  const [firstNameEn, setFirstNameEn] = useState('');
  const [lastNameEn, setLastNameEn] = useState('');
  const [firstNameAr, setFirstNameAr] = useState('');
  const [lastNameAr, setLastNameAr] = useState('');
  const [username, setUsername] = useState('');
  const [cityId, setCityId] = useState('');
  const [cityOptions, setCityOptions] = useState([]);
  const [nameErrors, setNameErrors] = useState({});
  const [nameSaving, setNameSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  // ---- Contact info (Security) ----
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [contactError, setContactError] = useState('');
  const [otpSent, setOtpSent] = useState('');

  // ---- Password (Security) ----
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwErrors, setPwErrors] = useState({});
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSubmitError, setPwSubmitError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // ---- Notifications (UI-only — no backend endpoint documented yet) ----
  const [notifJoinRequests, setNotifJoinRequests] = useState(true);
  const [notifMeetingReminders, setNotifMeetingReminders] = useState(true);
  const [notifContractUpdates, setNotifContractUpdates] = useState(true);
  const [notifChatMessages, setNotifChatMessages] = useState(false);

  // ---- Danger zone ----
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Seed everything from the cached profile once it loads.
  useEffect(() => {
    if (!profile) return;
    setFirstNameEn(profile.first_name_en || '');
    setLastNameEn(profile.last_name_en || '');
    setFirstNameAr(profile.first_name_ar || '');
    setLastNameAr(profile.last_name_ar || '');
    setUsername(profile.username || '');
    setCityId(profile.city_id || '');
    setEmail(profile.email || '');
    setPhone(profile.phone_number ? `+966 ${profile.phone_number}` : '');
    setEmailVerified(Boolean(profile.is_email_verified));
    setPhoneVerified(Boolean(profile.is_number_verified));
  }, [profile]);

  useEffect(() => {
    getSaudiCountryId()
      .then((saId) => (saId ? getCities(saId) : []))
      .then((cities) => setCityOptions(cities.map((c) => ({ value: c.id, label: c.name_en }))))
      .catch(() => {});
  }, []);

  // ---- Name save ----
  function requestNameSave() {
    const fields = [
      { key: 'firstNameEn', value: firstNameEn, lang: 'en', required: true },
      { key: 'lastNameEn', value: lastNameEn, lang: 'en', required: true },
      { key: 'firstNameAr', value: firstNameAr, lang: 'ar', required: true },
      { key: 'lastNameAr', value: lastNameAr, lang: 'ar', required: true },
    ];
    const next = {};
    fields.forEach((f) => {
      const err = validateName(f.value, { lang: f.lang, required: f.required });
      if (err) next[f.key] = err;
    });
    const usernameErr = validateUsername(username);
    if (usernameErr) next.username = usernameErr;
    setNameErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setNameError('');
    setConfirmState({ message: t('settings.confirmNameMsg'), onConfirm: doNameSave });
  }

  async function doNameSave() {
    setNameSaving(true);
    setNameError('');
    try {
      const updated = await updateProfile({
        first_name_en: firstNameEn, last_name_en: lastNameEn,
        first_name_ar: firstNameAr, last_name_ar: lastNameAr,
        username, city_id: cityId || null,
      });
      queryClient.setQueryData(profileQueryKey, updated);
    } catch (e) {
      setNameError(getApiErrorMessage(e, t('signup.errorGeneric')));
    } finally {
      setNameSaving(false);
    }
  }

  const nameFieldError = (field) =>
    nameErrors[field] ? { error: true, errorText: t(`signup.${nameErrors[field]}`) } : {};

  // ---- Contact info save ----
  function requestContactSave() {
    setConfirmState({ message: t('settings.confirmContactMsg'), onConfirm: doContactSave });
  }
  async function doContactSave() {
    setContactSaving(true);
    setContactError('');
    try {
      const updated = await updateProfile({ email });
      queryClient.setQueryData(profileQueryKey, updated);
    } catch (e) {
      setContactError(getApiErrorMessage(e, t('signup.errorGeneric')));
    } finally {
      setContactSaving(false);
    }
  }
  async function handleSendVerification(channel) {
    setOtpSent('');
    try {
      if (channel === 'email') await sendEmailOtp();
      else await sendPhoneOtp();
      setOtpSent(channel);
    } catch (e) {
      setContactError(getApiErrorMessage(e, t('signup.errorGeneric')));
    }
  }

  // ---- Password save ----
  function requestPasswordSave() {
    const next = {};
    if (!currentPassword) next.current = 'errRequired';
    const pass = validatePassword(newPassword);
    if (pass) next.new = pass;
    else if (newPassword === currentPassword) next.new = 'errSamePassword';
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
    } catch (e) {
      setPwSubmitError(getApiErrorMessage(e, t('signup.errorGeneric')));
    } finally {
      setPwSaving(false);
    }
  }
  const pwFieldError = (field) =>
    pwErrors[field] ? { error: true, errorText: t(`signup.${pwErrors[field]}`) } : {};

  // ---- Danger zone ----
  function requestDelete() {
    setConfirmState({ message: t('settings.confirmDeleteMsg'), onConfirm: doDelete });
  }
  async function doDelete() {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount();
      onNavigate?.('login');
    } catch (e) {
      setDeleteError(getApiErrorMessage(e, t('signup.errorGeneric')));
    } finally {
      setDeleting(false);
    }
  }

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

            {/* ---- Account: Name ---- */}
            <section id="settings-account" className="st__panel">
              <div className="st__panel-head">
                <h3>{t('settings.nameTitle')}</h3>
                <p className="st__panel-desc">{t('settings.nameDesc')}</p>
              </div>
              <div className="st__row2">
                <Input label={t('signup.firstNameEn')} value={firstNameEn} onChange={(e) => setFirstNameEn(e.target.value)} {...nameFieldError('firstNameEn')} />
                <Input label={t('signup.lastNameEn')} value={lastNameEn} onChange={(e) => setLastNameEn(e.target.value)} {...nameFieldError('lastNameEn')} />
              </div>
              <div className="st__row2">
                <Input label={t('signup.firstNameAr')} value={firstNameAr} onChange={(e) => setFirstNameAr(e.target.value)} {...nameFieldError('firstNameAr')} />
                <Input label={t('signup.lastNameAr')} value={lastNameAr} onChange={(e) => setLastNameAr(e.target.value)} {...nameFieldError('lastNameAr')} />
              </div>
              <div className="st__row2">
                <Input label={t('signup.username')} value={username} onChange={(e) => setUsername(e.target.value)} {...nameFieldError('username')} />
                <Select label={t('profile.location')} value={cityId} onChange={setCityId} options={cityOptions} />
              </div>
              {nameError && <p className="st__error">{nameError}</p>}
              <div className="st__save-row">
                <Button variant="primary" onClick={requestNameSave} disabled={nameSaving}>{t('myProfile.save')}</Button>
              </div>
            </section>

            {/* ---- Security: contact info + password ---- */}
            <section id="settings-security" className="st__panel">
              <div className="st__panel-head">
                <h3>{t('settings.contactTitle')}</h3>
                <p className="st__panel-desc">{t('settings.contactDesc')}</p>
              </div>

              <div className="st__field">
                <Input label={t('login.email')} value={email} onChange={(e) => setEmail(e.target.value)} />
                <span className={`st__verify-badge${emailVerified ? ' st__verify-badge--ok' : ''}`}>
                  {emailVerified ? t('settings.verified') : t('settings.notVerified')}
                </span>
              </div>
              <div className="st__field">
                <Input label={t('signup.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
                <span className={`st__verify-badge${phoneVerified ? ' st__verify-badge--ok' : ''}`}>
                  {phoneVerified ? t('settings.verified') : t('settings.notVerified')}
                </span>
              </div>
              {!emailVerified && (
                <button type="button" className="st__link" onClick={() => handleSendVerification('email')}>
                  {t('settings.sendVerificationEmail')} →
                </button>
              )}
              {!phoneVerified && (
                <button type="button" className="st__link" onClick={() => handleSendVerification('phone')}>
                  {t('settings.sendVerificationPhone')} →
                </button>
              )}
              {otpSent && <p className="st__hint">{t('settings.codeSent')}</p>}
              {contactError && <p className="st__error">{contactError}</p>}
              <div className="st__save-row">
                <Button variant="primary" onClick={requestContactSave} disabled={contactSaving}>{t('myProfile.save')}</Button>
              </div>
            </section>

            <section className="st__panel">
              <div className="st__panel-head">
                <h3>{t('myProfile.changePassword')}</h3>
                <p className="st__panel-desc">{t('settings.passwordDesc')}</p>
              </div>
              <div className="st__row2">
                <Input
                  label={t('myProfile.currentPassword')} type={showCurrent ? 'text' : 'password'}
                  value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
                  trailingIcon={eyeToggle(showCurrent)} onTrailingClick={() => setShowCurrent((s) => !s)}
                  {...pwFieldError('current')}
                />
                <Input
                  label={t('myProfile.newPassword')} type={showNew ? 'text' : 'password'}
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  trailingIcon={eyeToggle(showNew)} onTrailingClick={() => setShowNew((s) => !s)}
                  {...pwFieldError('new')}
                />
              </div>
              {pwSubmitError && <p className="st__error">{pwSubmitError}</p>}
              {pwSuccess && <p className="st__hint">{pwSuccess}</p>}
              <div className="st__save-row">
                <Button variant="primary" onClick={requestPasswordSave} disabled={pwSaving}>{t('myProfile.changePassword')}</Button>
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

            {/* ---- Connected accounts ---- */}
            <section id="settings-connected" className="st__panel">
              <div className="st__panel-head">
                <h3>{t('settings.connectedTitle')}</h3>
                <p className="st__panel-desc">{t('settings.connectedDesc')}</p>
              </div>
              <div className="st__connected-row">
                <div className="st__connected-left">
                  <span className="st__connected-icon"><Calendar width={18} height={18} aria-hidden="true" /></span>
                  <div>
                    <p className="st__connected-name">Cal.com</p>
                    <p className="st__connected-status">
                      {profile?.calcom_user_id ? `● ${t('settings.connected')}` : t('settings.notConnected')}
                    </p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" disabled>{t('settings.disconnect')}</Button>
              </div>
              <div className="st__connected-row">
                <div className="st__connected-left">
                  <span className="st__connected-icon"><LinkIcon width={18} height={18} aria-hidden="true" /></span>
                  <div>
                    <p className="st__connected-name">GitHub</p>
                    <p className="st__connected-status">{t('settings.notConnected')}</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" disabled>{t('settings.disconnect')}</Button>
              </div>
              <p className="st__hint">{t('settings.connectedNotWired')}</p>
            </section>

            {/* ---- Danger zone ---- */}
            <section id="settings-danger" className="st__panel st__panel--danger">
              <div className="st__panel-head">
                <h3 className="st__danger-title">{t('settings.dangerTitle')}</h3>
              </div>
              <div className="st__danger-row">
                <div>
                  <p className="st__danger-item-title">{t('settings.deleteTitle')}</p>
                  <p className="st__danger-item-sub">{t('settings.deleteDesc')}</p>
                </div>
                <Button variant="secondary" className="st__btn-danger" onClick={requestDelete} disabled={deleting}>{t('settings.deleteAccount')}</Button>
              </div>
              {deleteError && <p className="st__error">{deleteError}</p>}
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
