import { useState } from 'react';
import Button from '@/shared/components/Button';
import Input from '@/shared/components/Input';
import Checkbox from '@/shared/components/Checkbox';
import logoUrl from '@/assets/logo/Bayn-svg.svg?url';
import heroBg from '@/assets/images/register-photo-page-1.png';
import './SignUpPage.css';

const translations = {
  en: {
    title: 'Create your account',
    steps: ['Account information', 'Verification', 'Profile setup'],
    email: 'Email',
    emailPlaceholder: 'user@email.com',
    firstName: 'First Name',
    lastName: 'Last Name',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    username: 'Username',
    middleName: 'Middle Name',
    dob: 'Date of Birth',
    dobPlaceholder: 'DD / MM / YYYY',
    phone: 'Phone Number',
    strengthLabel: 'Password Strength',
    rules: [
      'At least 8 characters',
      'One uppercase letter',
      'One number',
      'One Digit #,$,@ at least',
    ],
    termsPrefix: "By clicking here you agree to Bayn's ",
    termsAgreement: 'User Agreement',
    termsComma: ', ',
    termsPrivacy: 'Privacy Policy',
    termsAnd: ' and ',
    termsCookies: 'Cookies Policy',
    nextStep: 'Next Step',
    haveAccount: 'Already have an account?',
    logIn: 'Log in',
    langBtn: 'English',
    errorEmpty: 'Please fill in all required fields.',
    errorPassword: 'Passwords do not match.',
    errorTerms: 'Please agree to the terms.',
  },
  ar: {
    title: 'إنشاء حسابك',
    steps: ['معلومات الحساب', 'التحقق', 'إعداد الملف الشخصي'],
    email: 'البريد الإلكتروني',
    emailPlaceholder: 'user@email.com',
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    password: 'كلمة المرور',
    confirmPassword: 'تأكيد كلمة المرور',
    username: 'اسم المستخدم',
    middleName: 'الاسم الأوسط',
    dob: 'تاريخ الميلاد',
    dobPlaceholder: 'YYYY / MM / DD',
    phone: 'رقم الجوال',
    strengthLabel: 'قوة كلمة المرور',
    rules: [
      '8 أحرف على الأقل',
      'حرف كبير واحد',
      'رقم واحد',
      'رمز خاص #,$,@ على الأقل',
    ],
    termsPrefix: 'بالنقر هنا توافق على ',
    termsAgreement: 'اتفاقية المستخدم',
    termsComma: '، ',
    termsPrivacy: 'سياسة الخصوصية',
    termsAnd: ' و',
    termsCookies: 'سياسة ملفات تعريف الارتباط',
    nextStep: 'الخطوة التالية',
    haveAccount: 'لديك حساب بالفعل؟',
    logIn: 'تسجيل الدخول',
    langBtn: 'العربية',
    errorEmpty: 'يرجى ملء جميع الحقول المطلوبة.',
    errorPassword: 'كلمتا المرور غير متطابقتين.',
    errorTerms: 'يرجى الموافقة على الشروط والأحكام.',
  },
};

const GlobeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

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

const ArrowRight = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const HeadsetIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
    <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
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

function PasswordStrength({ password, tx }) {
  const score = passwordScore(password);
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[#$@]/.test(password),
  ];

  return (
    <div className="pw-str">
      <div className="pw-str__header">
        <span className="pw-str__title">{tx.strengthLabel}</span>
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
        {tx.rules.map((rule, i) => (
          <li key={i} className={`pw-str__rule${checks[i] ? ' pw-str__rule--ok' : ''}`}>
            {rule}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SignUpPage({ onNavigate }) {
  const [lang, setLang] = useState('en');

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

  const isRtl = lang === 'ar';
  const tx = translations[lang];

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email || !firstName || !lastName || !password || !confirmPassword) {
      setError(tx.errorEmpty);
      return;
    }
    if (password !== confirmPassword) {
      setError(tx.errorPassword);
      return;
    }
    if (!agreed) {
      setError(tx.errorTerms);
      return;
    }
    alert('Step 1 complete!');
  }

  return (
    <div className={`su${isRtl ? ' su--rtl' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>

      <div className="su__main">
        <img src={logoUrl} alt="Bayn" className="su__logo" />

        <h1 className="su__title">{tx.title}</h1>

        <form className="su__form" onSubmit={handleSubmit} noValidate>
          <div className="su__grid">
            <div className="su__col">
              <Input label={tx.email} type="email" value={email} onChange={e => setEmail(e.target.value)} className="su__input" />
              <Input label={tx.firstName} value={firstName} onChange={e => setFirstName(e.target.value)} className="su__input" />
              <Input label={tx.lastName} value={lastName} onChange={e => setLastName(e.target.value)} className="su__input" />
              <Input
                label={tx.password}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                trailingIcon={showPassword ? <EyeOpen /> : <EyeOff />}
                onTrailingClick={() => setShowPassword(p => !p)}
                className="su__input"
              />
              <Input
                label={tx.confirmPassword}
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                trailingIcon={showConfirm ? <EyeOpen /> : <EyeOff />}
                onTrailingClick={() => setShowConfirm(p => !p)}
                className="su__input"
              />
            </div>

            <div className="su__col">
              <Input label={tx.username} value={username} onChange={e => setUsername(e.target.value)} className="su__input" />
              <Input label={tx.middleName} value={middleName} onChange={e => setMiddleName(e.target.value)} className="su__input" />
              <Input label={tx.dob} value={dob} onChange={e => setDob(e.target.value)} className="su__input" />
              <Input label={tx.phone} type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="su__input" />
              <PasswordStrength password={password} tx={tx} />
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
                    {tx.termsPrefix}
                    <a href="/terms" className="su__terms-link">{tx.termsAgreement}</a>
                    {tx.termsComma}
                    <a href="/privacy" className="su__terms-link">{tx.termsPrivacy}</a>
                    {tx.termsAnd}
                    <a href="/cookies" className="su__terms-link">{tx.termsCookies}</a>
                  </span>
                }
              />
            </div>

            <div className="su__action-row">
              <Button type="submit" variant="primary" size="lg" trailingIcon={<ArrowRight />} className="su__submit">
                {tx.nextStep}
              </Button>
              <p className="su__login-text">
                {tx.haveAccount}{' '}
                <button type="button" className="su__login-link" onClick={() => onNavigate('login')}>
                  {tx.logIn}
                </button>
              </p>
            </div>
          </div>
        </form>
      </div>

      <div className="su__hero" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="su__hero-overlay" />
        <button className="su__lang-btn" onClick={() => setLang(isRtl ? 'en' : 'ar')}>
          <GlobeIcon />
          <span>{tx.langBtn}</span>
        </button>
      </div>

      <div className="su__fabs">
        <Button variant="primary" size="md" iconOnly aria-label="Home">
          <HomeIcon />
        </Button>
        <Button variant="primary" size="md" iconOnly aria-label="Support">
          <HeadsetIcon />
        </Button>
      </div>

    </div>
  );
}
