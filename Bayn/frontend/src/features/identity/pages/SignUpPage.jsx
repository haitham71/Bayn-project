import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import IdentityLayout from '@/layouts/IdentityLayout';
import Stepper from '../components/Stepper';
import Button from '@/shared/components/Button';
import Input from '@/shared/components/Input';
import Checkbox from '@/shared/components/Checkbox';
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

export default function SignUpPage({ onNavigate }) {
  const { t } = useTranslation();

  const steps = [
    { key: 'account', label: t('steps.account') },
    { key: 'verification', label: t('steps.verification') },
    { key: 'profile', label: t('steps.profile') },
  ];

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email || !firstName || !lastName || !password || !confirmPassword) {
      setError(t('signup.errorEmpty'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('signup.errorPassword'));
      return;
    }
    if (!agreed) {
      setError(t('signup.errorTerms'));
      return;
    }
    onNavigate('verification');
  }

  return (
    <IdentityLayout contentClassName="su__content">
      <h1 className="su__title">{t('signup.title')}</h1>

      <div className="su__stepper">
        <Stepper steps={steps} current={0} />
      </div>

      <form className="su__form" onSubmit={handleSubmit} noValidate>
        <div className="su__grid">
          <div className="su__col">
            <Input label={t('signup.email')} type="email" value={email} onChange={e => setEmail(e.target.value)} className="su__input" />
            <Input label={t('signup.firstName')} value={firstName} onChange={e => setFirstName(e.target.value)} className="su__input" />
            <Input label={t('signup.lastName')} value={lastName} onChange={e => setLastName(e.target.value)} className="su__input" />
            <Input
              label={t('signup.password')}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              trailingIcon={showPassword ? <EyeOpen /> : <EyeOff />}
              onTrailingClick={() => setShowPassword(p => !p)}
              className="su__input"
            />
            <Input
              label={t('signup.confirmPassword')}
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              trailingIcon={showConfirm ? <EyeOpen /> : <EyeOff />}
              onTrailingClick={() => setShowConfirm(p => !p)}
              className="su__input"
            />
          </div>

          <div className="su__col">
            <Input label={t('signup.username')} value={username} onChange={e => setUsername(e.target.value)} className="su__input" />
            <Input label={t('signup.middleName')} value={middleName} onChange={e => setMiddleName(e.target.value)} className="su__input" />
            <Input label={t('signup.dob')} value={dob} onChange={e => setDob(e.target.value)} className="su__input" />
            <Input label={t('signup.phone')} type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="su__input" />
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
