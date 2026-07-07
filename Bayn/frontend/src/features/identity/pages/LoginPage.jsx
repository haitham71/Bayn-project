import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import IdentityLayout from '@/layouts/IdentityLayout';
import Button from '@/shared/components/Button';
import Input from '@/shared/components/Input';
import './LoginPage.css';

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

export default function LoginPage({ onNavigate }) {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError(t('login.error'));
      return;
    }
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  }

  return (
    <IdentityLayout>
      <form className="lp__form" onSubmit={handleSubmit} noValidate>
        <h2 className="lp__title">{t('login.welcome')}</h2>

        <div className="lp__fields">
          <Input
            label={t('login.email')}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="lp__input"
          />
          <Input
            label={t('login.password')}
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
          {loading ? t('login.loading') : t('login.signIn')}
        </Button>

        <div className="lp__links">
          <a href="/forgot-password" className="lp__link">{t('login.forgot')}</a>
          <p className="lp__sub">
            {t('login.noAccount')}{' '}
            <button type="button" className="lp__link lp__link--bold" onClick={() => onNavigate('signup')}>
              {t('login.signUp')}
            </button>
          </p>
        </div>
      </form>
    </IdentityLayout>
  );
}
