import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import IdentityLayout from '@/layouts/IdentityLayout';
import Stepper from '../components/Stepper';
import Button from '@/shared/components/Button';
import Input from '@/shared/components/Input';
import Checkbox from '@/shared/components/Checkbox';
import Eye from '@/assets/icons/eye.svg?react';
import EyeOff from '@/assets/icons/eye-off.svg?react';
import PasswordStrength from '@/shared/components/PasswordStrength';
import { LegalLink } from '@/features/legal/components/LegalLink';
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
import { signup } from '../services/authService';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import './SignUpPage.css';

export default function SignUpPage({ onNavigate, initialData = {}, onDataChange }) {
  const { t, i18n } = useTranslation();
  // Only the name matching the page's current language is mandatory; the
  // other script is optional (still sent to the backend, blank if unfilled).
  const isArabicUI = i18n.language?.startsWith('ar');

  const steps = [
    { key: 'account', label: t('steps.account') },
    { key: 'verification', label: t('steps.verification') },
    { key: 'profile', label: t('steps.profile') },
  ];

  const [email, setEmail] = useState(initialData.email || '');
  const [firstNameAr, setFirstNameAr] = useState(initialData.firstNameAr || '');
  const [lastNameAr, setLastNameAr] = useState(initialData.lastNameAr || '');
  const [firstNameEn, setFirstNameEn] = useState(initialData.firstNameEn || '');
  const [lastNameEn, setLastNameEn] = useState(initialData.lastNameEn || '');
  const [username, setUsername] = useState(initialData.username || '');
  const [password, setPassword] = useState(initialData.password || '');
  const [confirmPassword, setConfirmPassword] = useState(initialData.confirmPassword || '');
  const [dob, setDob] = useState(initialData.dob || '');
  const [phone, setPhone] = useState(initialData.phone || '+966');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(initialData.agreed || false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Lift the current values up so they survive navigating to verification and
  // back (the page itself unmounts, but App keeps the data).
  useEffect(() => {
    onDataChange?.({
      email, firstNameAr, lastNameAr, firstNameEn, lastNameEn, username,
      password, confirmPassword, dob, phone, agreed,
    });
  }, [email, firstNameAr, lastNameAr, firstNameEn, lastNameEn, username, password, confirmPassword, dob, phone, agreed]);

  // Turns the validators' error codes into a field -> localized message map.
  function collectErrors() {
    const next = {};
    const email_ = validateEmail(email);
    if (email_) next.email = email_;
    const fnAr = validateName(firstNameAr, { lang: 'ar', required: isArabicUI });
    if (fnAr) next.firstNameAr = fnAr;
    const lnAr = validateName(lastNameAr, { lang: 'ar', required: isArabicUI });
    if (lnAr) next.lastNameAr = lnAr;
    const fnEn = validateName(firstNameEn, { lang: 'en', required: !isArabicUI });
    if (fnEn) next.firstNameEn = fnEn;
    const lnEn = validateName(lastNameEn, { lang: 'en', required: !isArabicUI });
    if (lnEn) next.lastNameEn = lnEn;
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const found = collectErrors();
    setErrors(found);

    if (Object.values(found).some(Boolean)) return;
    if (!agreed) {
      setError(t('signup.errorTerms'));
      return;
    }

    setSubmitting(true);
    try {
      // Starts the pending signup (backend sends the email OTP) and hands the
      // pending_token to the verification step; the account is created there.
      const res = await signup({
        email, username,
        firstNameEn, lastNameEn,
        firstNameAr, lastNameAr,
        password, dob, phone, agreed,
      });
      onDataChange?.({ pendingToken: res.pending_token });
      onNavigate('verification');
    } catch (err) {
      setError(getApiErrorMessage(err, t('signup.errorGeneric')));
    } finally {
      setSubmitting(false);
    }
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


        <div className="su__row">
          <Input
            label={t('signup.firstNameAr')}
            value={firstNameAr}
            onChange={e => { setFirstNameAr(e.target.value); clearError('firstNameAr'); }}
            className="su__input"
            {...fieldError('firstNameAr')}
          />
          <Input
            label={t('signup.lastNameAr')}
            value={lastNameAr}
            onChange={e => { setLastNameAr(e.target.value); clearError('lastNameAr'); }}
            className="su__input"
            {...fieldError('lastNameAr')}
          />
        </div>

        <div className="su__row">
          <Input
            label={t('signup.firstNameEn')}
            value={firstNameEn}
            onChange={e => { setFirstNameEn(e.target.value); clearError('firstNameEn'); }}
            className="su__input"
            {...fieldError('firstNameEn')}
          />
          <Input
            label={t('signup.lastNameEn')}
            value={lastNameEn}
            onChange={e => { setLastNameEn(e.target.value); clearError('lastNameEn'); }}
            className="su__input"
            {...fieldError('lastNameEn')}
          />
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
            trailingIcon={showPassword ? <Eye width={20} height={20} aria-hidden="true" /> : <EyeOff width={20} height={20} aria-hidden="true" />}
            onTrailingClick={() => setShowPassword(p => !p)}
            className="su__input"
            {...fieldError('password')}
          />
          <Input
            label={t('signup.confirmPassword')}
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); clearError('confirmPassword'); }}
            trailingIcon={showConfirm ? <Eye width={20} height={20} aria-hidden="true" /> : <EyeOff width={20} height={20} aria-hidden="true" />}
            onTrailingClick={() => setShowConfirm(p => !p)}
            className="su__input"
            {...fieldError('confirmPassword')}
          />
        </div>

        <PasswordStrength password={password} />

        {error && <p className="su__error">{error}</p>}

        <div className="su__footer">
          <div className="su__terms-row">
            <Checkbox
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              label={
                <span className="su__terms-text">
                  {t('signup.termsPrefix')}
                  <LegalLink to="/terms" fromCrumb={{ label: 'إنشاء الحساب', to: '/signup' }} className="su__terms-link">{t('signup.termsAgreement')}</LegalLink>
                  {t('signup.termsAnd')}
                  <LegalLink to="/privacy" fromCrumb={{ label: 'إنشاء الحساب', to: '/signup' }} className="su__terms-link">{t('signup.termsPrivacy')}</LegalLink>
                </span>
              }
            />
          </div>

          <div className="su__action-row">
            <Button type="submit" variant="primary" size="lg" trailingIcon className="su__submit" disabled={submitting}>
              {submitting ? t('signup.submitting') : t('signup.nextStep')}
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
