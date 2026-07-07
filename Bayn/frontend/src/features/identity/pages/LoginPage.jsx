import { useState } from 'react';
import Button from '@/shared/components/Button';
import Input from '@/shared/components/Input';
import logoUrl from '@/assets/logo/Bayn-svg.svg?url';
import heroBg from '@/assets/images/register-photo-page-1.png';
import './LoginPage.css';

const translations = {
  en: {
    heroTitle: 'We document every step,\nso you can build the future.',
    welcome: 'Welcome Back!',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign In',
    forgot: 'Forgot your password?',
    noAccount: "Don't have an account?",
    signUp: 'Sign Up',
    langBtn: 'English',
    loading: 'Loading...',
    error: 'Please fill in all fields.',
  },
  ar: {
    heroTitle: 'نوثّق كل خطوة\nلتبني المستقبل',
    welcome: 'مرحباً بعودتك!',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    signIn: 'تسجيل الدخول',
    forgot: 'نسيت كلمة المرور؟',
    noAccount: 'ليس لديك حساب؟',
    signUp: 'إنشاء حساب',
    langBtn: 'العربية',
    loading: 'جاري التحميل...',
    error: 'يرجى ملء جميع الحقول.',
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

export default function LoginPage({ onNavigate }) {
  const [lang, setLang] = useState('en');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isRtl = lang === 'ar';
  const tx = translations[lang];

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError(tx.error);
      return;
    }
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  }

  return (
    <div className={`lp${isRtl ? ' lp--rtl' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>

      <div className="lp__hero" style={{ backgroundImage: `url(${heroBg})` }}>
        <button className="lp__lang-btn" onClick={() => setLang(isRtl ? 'en' : 'ar')}>
          <GlobeIcon />
          <span>{tx.langBtn}</span>
        </button>

        <div className="lp__hero-body">
          <div className="lp__hero-content">
            <h1 className="lp__hero-title">{tx.heroTitle}</h1>
            <p className="lp__hero-desc">{tx.heroDesc}</p>
          </div>
        </div>
      </div>

      <div className="lp__panel">
        <img src={logoUrl} alt="Bayn" className="lp__logo" />

        <form className="lp__form" onSubmit={handleSubmit} noValidate>
          <h2 className="lp__title">{tx.welcome}</h2>

          <div className="lp__fields">
            <Input
              label={tx.email}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="lp__input"
            />
            <Input
              label={tx.password}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              trailingIcon={showPassword ? <EyeOpen /> : <EyeOff />}
              onTrailingClick={() => setShowPassword(p => !p)}
              className="lp__input"
            />
          </div>

          {error && <p className="lp__error">{error}</p>}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            trailingIcon={<ArrowRight />}
            className="lp__submit"
            disabled={loading}
          >
            {loading ? tx.loading : tx.signIn}
          </Button>

          <div className="lp__links">
            <a href="/forgot-password" className="lp__link">{tx.forgot}</a>
            <p className="lp__sub">
              {tx.noAccount}{' '}
              <button type="button" className="lp__link lp__link--bold" onClick={() => onNavigate('signup')}>
                {tx.signUp}
              </button>
            </p>
          </div>
        </form>

        <div className="lp__fabs">
          <Button variant="primary" size="md" iconOnly aria-label="Home">
            <HomeIcon />
          </Button>
          <Button variant="primary" size="md" iconOnly aria-label="Support">
            <HeadsetIcon />
          </Button>
        </div>
      </div>

    </div>
  );
}
