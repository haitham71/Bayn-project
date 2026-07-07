import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import IdentityLayout from '@/layouts/IdentityLayout';
import Stepper from '../components/Stepper';
import Button from '@/shared/components/Button';
import Input from '@/shared/components/Input';
import Checkbox from '@/shared/components/Checkbox';
import {
  validateEmail,
  validateName,
  validateUsername,
  validateDob,
  validatePhone,
  validatePassword,
  formatDob,
  formatPhone,
} from '../utils/validation';
import './SignUpPage.css';

const EyeOpen = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOff = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

function passwordScore(pw) {
  return [
    pw.length >= 8,
    /[A-Z]/.test(pw),
    /[0-9]/.test(pw),
    /[#$@]/.test(pw),
  ].filter(Boolean).length;
}

function PasswordStrength({ password, t }) {
  const score = passwordScore(password);
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[#$@]/.test(password),
  ];
  const rules = t('signup.rules', { returnObjects: true });

  return (
    <div className="pw-str">
      <div className="pw-str__header">
        <span className="pw-str__title">{t('signup.strengthLabel')}</span>
        <div className="pw-str__bars">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`pw-str__bar${i < score ? ' pw-str__bar--on' : ''}`}
            />
          ))}
        </div>
      </div>
      <ul className="pw-str__list">
        {rules.map((rule, i) => (
          <li key={i} className={`pw-str__rule${checks[i] ? ' pw-str__rule--ok' : ''}`}>
            {rule}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SignUpPage({ onNavigate, initialData = {}, onDataChange }) {
  const { t } = useTranslation();

  const steps = [
    { key: 'account', label: t('steps.account') },
    { key: 'verification', label: t('steps.verification') },
    { key: 'profile', label: t('steps.profile') },
  ];

  const [email, setEmail] = useState(initialData.email || '');
  const [username, setUsername] = useState(initialData.username || '');
  // Names are captured in both languages; a toggle switches which set is shown.
  const [nameLang, setNameLang] = useState(initialData.nameLang || 'en');
  const [firstNameEn, setFirstNameEn] = useState(initialData.firstNameEn || '');
  const [secondNameEn, setSecondNameEn] = useState(initialData.secondNameEn || '');
  const [thirdNameEn, setThirdNameEn] = useState(initialData.thirdNameEn || '');
  const [lastNameEn, setLastNameEn] = useState(initialData.lastNameEn || '');
  const [firstNameAr, setFirstNameAr] = useState(initialData.firstNameAr || '');
  const [secondNameAr, setSecondNameAr] = useState(initialData.secondNameAr || '');
  const [thirdNameAr, setThirdNameAr] = useState(initialData.thirdNameAr || '');
  const [lastNameAr, setLastNameAr] = useState(initialData.lastNameAr || '');
  const [password, setPassword] = useState(initialData.password || '');
  const [confirmPassword, setConfirmPassword] = useState(initialData.confirmPassword || '');
  const [dob, setDob] = useState(initialData.dob || '');
  const [phone, setPhone] = useState(initialData.phone || '+966');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(initialData.agreed || false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');

  // Lift the current values up so they survive navigating to verification and
  // back (the page itself unmounts, but App keeps the data).
  useEffect(() => {
    onDataChange?.({
      email, username, nameLang,
      firstNameEn, secondNameEn, thirdNameEn, lastNameEn,
      firstNameAr, secondNameAr, thirdNameAr, lastNameAr,
      password, confirmPassword, dob, phone, agreed,
    });
  }, [email, username, nameLang, firstNameEn, secondNameEn, thirdNameEn, lastNameEn, firstNameAr, secondNameAr, thirdNameAr, lastNameAr, password, confirmPassword, dob, phone, agreed]);

  // The name fields for the language the toggle is currently showing.
  // The third name maps to third_name on the backend.
  const nameSet = nameLang === 'en'
    ? [
        { key: 'firstNameEn', label: 'firstName', value: firstNameEn, set: setFirstNameEn },
        { key: 'secondNameEn', label: 'secondName', value: secondNameEn, set: setSecondNameEn },
        { key: 'thirdNameEn', label: 'thirdName', value: thirdNameEn, set: setThirdNameEn },
        { key: 'lastNameEn', label: 'lastName', value: lastNameEn, set: setLastNameEn },
      ]
    : [
        { key: 'firstNameAr', label: 'firstName', value: firstNameAr, set: setFirstNameAr },
        { key: 'secondNameAr', label: 'secondName', value: secondNameAr, set: setSecondNameAr },
        { key: 'thirdNameAr', label: 'thirdName', value: thirdNameAr, set: setThirdNameAr },
        { key: 'lastNameAr', label: 'lastName', value: lastNameAr, set: setLastNameAr },
      ];

  // Turns the validators' error codes into a field -> localized message map.
  function collectErrors() {
    const next = {};
    const email_ = validateEmail(email);
    if (email_) next.email = email_;
    const user = validateUsername(username);
    if (user) next.username = user;

    [
      ['firstNameEn', 'en', firstNameEn, true], ['secondNameEn', 'en', secondNameEn, true],
      ['thirdNameEn', 'en', thirdNameEn, true], ['lastNameEn', 'en', lastNameEn, true],
      ['firstNameAr', 'ar', firstNameAr, true], ['secondNameAr', 'ar', secondNameAr, true],
      ['thirdNameAr', 'ar', thirdNameAr, true], ['lastNameAr', 'ar', lastNameAr, true],
    ].forEach(([key, lang, value, required]) => {
      const err = validateName(value, { lang, required });
      if (err) next[key] = err;
    });

    const birth = validateDob(dob);
    if (birth) next.dob = birth;
    const tel = validatePhone(phone);
    if (tel) next.phone = tel;
    const pass = validatePassword(password);
    if (pass) next.password = pass;
    if (!pass && confirmPassword !== password) next.confirmPassword = 'errorPassword';
    return next;
  }

  // Clears a single field's error once the user starts fixing it.
  function clearError(field) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const found = collectErrors();
    setErrors(found);

    // Surface hidden-language name errors by switching the toggle to them.
    const enNameErr = found.firstNameEn || found.secondNameEn || found.thirdNameEn || found.lastNameEn;
    const arNameErr = found.firstNameAr || found.secondNameAr || found.thirdNameAr || found.lastNameAr;
    if (nameLang === 'en' && !enNameErr && arNameErr) setNameLang('ar');
    else if (nameLang === 'ar' && !arNameErr && enNameErr) setNameLang('en');

    if (Object.values(found).some(Boolean)) return;
    if (!agreed) {
      setError(t('signup.errorTerms'));
      return;
    }
    onNavigate('verification');
  }

  // Shared props that light up a field's error state + message.
  const fieldError = field =>
    errors[field] ? { error: true, errorText: t(`signup.${errors[field]}`) } : {};

  return (
    <IdentityLayout contentClassName="su__content">
      <h1 className="su__title">{t('signup.title')}</h1>

      <div className="su__stepper">
        <Stepper steps={steps} current={0} />
      </div>

      <form className="su__form" onSubmit={handleSubmit} noValidate>
        <div className="su__row">
          <Input
            label={t('signup.email')}
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); clearError('email'); }}
            className="su__input"
            {...fieldError('email')}
          />
          <Input
            label={t('signup.username')}
            value={username}
            onChange={e => { setUsername(e.target.value); clearError('username'); }}
            className="su__input"
            {...fieldError('username')}
          />
        </div>

        <div className="su__names">
          <div className="su__lang-toggle" role="group" aria-label="Name language">
            <button
              type="button"
              className={`su__lang-opt${nameLang === 'en' ? ' su__lang-opt--active' : ''}`}
              onClick={() => setNameLang('en')}
            >
              English
            </button>
            <button
              type="button"
              className={`su__lang-opt${nameLang === 'ar' ? ' su__lang-opt--active' : ''}`}
              onClick={() => setNameLang('ar')}
            >
              العربية
            </button>
          </div>

          <div className="su__names-grid">
            {nameSet.map(f => (
              <Input
                key={f.key}
                label={t(`signup.${f.label}`, { lng: nameLang })}
                value={f.value}
                onChange={e => { f.set(e.target.value); clearError(f.key); }}
                className="su__input"
                {...fieldError(f.key)}
              />
            ))}
          </div>
        </div>

        <div className="su__row">
          <Input
            label={t('signup.dob')}
            inputMode="numeric"
            value={dob}
            onChange={e => { setDob(formatDob(e.target.value)); clearError('dob'); }}
            supportingText="DD/MM/YYYY"
            className="su__input"
            {...fieldError('dob')}
          />
          <Input
            label={t('signup.phone')}
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={e => { setPhone(formatPhone(e.target.value)); clearError('phone'); }}
            className="su__input"
            {...fieldError('phone')}
          />
        </div>

        <div className="su__row">
          <Input
            label={t('signup.password')}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => { setPassword(e.target.value); clearError('password'); }}
            trailingIcon={showPassword ? <EyeOpen /> : <EyeOff />}
            onTrailingClick={() => setShowPassword(p => !p)}
            className="su__input"
            {...fieldError('password')}
          />
          <Input
            label={t('signup.confirmPassword')}
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); clearError('confirmPassword'); }}
            trailingIcon={showConfirm ? <EyeOpen /> : <EyeOff />}
            onTrailingClick={() => setShowConfirm(p => !p)}
            className="su__input"
            {...fieldError('confirmPassword')}
          />
        </div>

        <PasswordStrength password={password} t={t} />

        {error && <p className="su__error">{error}</p>}

        <div className="su__footer">
          <div className="su__terms-row">
            <Checkbox
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              label={
                <span className="su__terms-text">
                  {t('signup.termsPrefix')}
                  <a href="/terms" className="su__terms-link">{t('signup.termsAgreement')}</a>
                  {t('signup.termsComma')}
                  <a href="/privacy" className="su__terms-link">{t('signup.termsPrivacy')}</a>
                  {t('signup.termsAnd')}
                  <a href="/cookies" className="su__terms-link">{t('signup.termsCookies')}</a>
                </span>
              }
            />
          </div>

          <div className="su__action-row">
            <Button type="submit" variant="primary" size="lg" trailingIcon className="su__submit">
              {t('signup.nextStep')}
            </Button>
            <p className="su__login-text">
              {t('signup.haveAccount')}{' '}
              <button type="button" className="su__login-link" onClick={() => onNavigate('login')}>
                {t('signup.logIn')}
              </button>
            </p>
          </div>
        </div>
      </form>
    </IdentityLayout>
  );
}
