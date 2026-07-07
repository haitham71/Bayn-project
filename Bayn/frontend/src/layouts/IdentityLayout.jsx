import { useTranslation } from 'react-i18next';
import heroImage from '@/assets/images/register-photo-page-1.png';
import Button from '@/shared/components/Button';
import Logo from '@/assets/logo/Bayn-svg.svg?react';
import Home from '@/assets/icons/house.svg?react';
import Headset from '@/assets/icons/headset.svg?react';
import Languages from '@/assets/icons/languages.svg?react';
import './AuthLayout.css';

// Split-screen shell for the authentication flow: form column on one side,
// branded hero image on the other. The form content is passed as children.
export default function AuthLayout({ children }) {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
  };

  return (
    <div className="auth-layout">
      <section className="auth-layout__form">
        <div className="auth-layout__brand">
          <Logo width={64} height={48} aria-label="Bayn" />
        </div>
        <div className="auth-layout__content">{children}</div>
      </section>

      <aside
        className="auth-layout__hero"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="auth-layout__hero-overlay" />

        <div className="auth-layout__quick-actions">
          <Button
            iconOnly
            variant="primary"
            size="md"
            className="auth-layout__circle"
            aria-label={t('auth.home')}
          >
            <Home width={22} height={22} aria-hidden="true" />
          </Button>
          <Button
            iconOnly
            variant="primary"
            size="md"
            className="auth-layout__circle"
            aria-label={t('auth.support')}
          >
            <Headset width={22} height={22} aria-hidden="true" />
          </Button>
        </div>

        <button type="button" className="auth-layout__lang" onClick={toggleLanguage}>
          <Languages width={22} height={22} aria-hidden="true" />
          {t('auth.langName')}
        </button>

        <div className="auth-layout__hero-text">
          <h2 className="auth-layout__hero-title">{t('auth.heroTitle')}</h2>
          <p className="auth-layout__hero-subtitle">{t('auth.heroSubtitle')}</p>
        </div>
      </aside>
    </div>
  );
}
