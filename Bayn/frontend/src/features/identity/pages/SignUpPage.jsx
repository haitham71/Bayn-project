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
  const [firstName, setFirstName] = useState(initialData.firstName || '');
  const [lastName, setLastName] = useState(initialData.lastName || '');
  const [password, setPassword] = useState(initialData.password || '');
  const [confirmPassword, setConfirmPassword] = useState(initialData.confirmPassword || '');
  const [username, setUsername] = useState(initialData.username || '');
  const [middleName, setMiddleName] = useState(initialData.middleName || '');
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
      email, firstName, lastName, password, confirmPassword,
      username, middleName, dob, phone, agreed,
    });
  }, [email, firstName, lastName, password, confirmPassword, username, middleName, dob, phone, agreed]);

  // Turns the validators' error codes into a field -> localized message map.
  function collectErrors() {
    const next = {};
    const email_ = validateEmail(email);
    if (email_) next.email = email_;
    const first = validateName(firstName);
    if (first) next.firstName = first;
    const last = validateName(lastName);
    if (last) next.lastName = last;
    const middle = validateName(middleName);
    if (middle) next.middleName = middle;
    const user = validateUsername(username);
    if (user) next.username = user;
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
        <div className="su__grid">
          <div className="su__col">
            <Input
              label={t('signup.email')}
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); clearError('email'); }}
              className="su__input"
              {...fieldError('email')}
            />
            <Input
              label={t('signup.firstName')}
              value={firstName}
              onChange={e => { setFirstName(e.target.value); clearError('firstName'); }}
              className="su__input"
              {...fieldError('firstName')}
            />
            <Input
              label={t('signup.lastName')}
              value={lastName}
              onChange={e => { setLastName(e.target.value); clearError('lastName'); }}
              className="su__input"
              {...fieldError('lastName')}
            />
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

          <div className="su__col">
            <Input
              label={t('signup.username')}
              value={username}
              onChange={e => { setUsername(e.target.value); clearError('username'); }}
              className="su__input"
              {...fieldError('username')}
            />
            <Input
              label={t('signup.middleName')}
              value={middleName}
              onChange={e => { setMiddleName(e.target.value); clearError('middleName'); }}
              className="su__input"
              {...fieldError('middleName')}
            />
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
            <PasswordStrength password={password} t={t} />
          </div>
        </div>

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
