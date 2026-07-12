import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import IdentityLayout from '@/layouts/IdentityLayout';
import Button from '@/shared/components/Button';
import Input from '@/shared/components/Input';
import Eye from '@/assets/icons/eye.svg?react';
import EyeOff from '@/assets/icons/eye-off.svg?react';
import './LoginPage.css';

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
            trailingIcon={showPassword ? <Eye width={20} height={20} aria-hidden="true" /> : <EyeOff width={20} height={20} aria-hidden="true" />}
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
