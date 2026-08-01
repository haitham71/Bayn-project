import { useEffect, useRef, useState } from 'react';
import { useLangNavigate, useLangSwitch } from '@/shared/hooks/useLang';
import { useTranslation } from 'react-i18next';
import heroImage from '@/assets/images/register-photo-page-1.png';
import Button from '@/shared/components/Button';
import SupportCard from '@/shared/components/SupportCard';
import Logo from '@/assets/logo/Bayn-svg.svg?react';
import Home from '@/assets/icons/house.svg?react';
import Headset from '@/assets/icons/headset.svg?react';
import Languages from '@/assets/icons/languages.svg?react';
import './IdentityLayout.css';

// Split-screen shell for the identity/authentication flow: form column on one
// side, branded hero image on the other. The form content is passed as children.
export default function IdentityLayout({ children, contentClassName = '' }) {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const toggleLanguage = useLangSwitch();

  // Support contact popover — closes on outside click or Escape.
  const [supportOpen, setSupportOpen] = useState(false);
  const supportRef = useRef(null);
  useEffect(() => {
    if (!supportOpen) return undefined;
    function onDown(e) {
      if (supportRef.current && !supportRef.current.contains(e.target)) setSupportOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setSupportOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [supportOpen]);

  return (
    <div className="identity-layout">
      {/* Entrance: the hero slides in from its edge while the form settles
          upward just behind it — see styles/enter.css. */}
      <section className="identity-layout__form">
        <div className="identity-layout__brand bayn-enter">
          <Logo width={64} height={48} aria-label="Beyn" />
        </div>
        <div
          className={`identity-layout__content bayn-enter ${contentClassName}`.trim()}
          style={{ '--enter-delay': '0.1s' }}
        >
          {children}
        </div>
      </section>

      <aside
        className="identity-layout__hero bayn-enter--side"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="identity-layout__hero-overlay" />

        <div className="identity-layout__quick-actions">
          <Button
            iconOnly
            variant="primary"
            size="md"
            className="identity-layout__circle"
            aria-label={t('auth.home')}
            onClick={() => navigate('/')}
          >
            <Home width={22} height={22} aria-hidden="true" />
          </Button>
          <div className="identity-layout__support" ref={supportRef}>
            <Button
              iconOnly
              variant="primary"
              size="md"
              className="identity-layout__circle"
              aria-label={t('auth.support')}
              aria-expanded={supportOpen}
              onClick={() => setSupportOpen((v) => !v)}
            >
              <Headset width={22} height={22} aria-hidden="true" />
            </Button>
            {supportOpen && <SupportCard className="identity-layout__support-card" />}
          </div>
        </div>

        <button type="button" className="identity-layout__lang" onClick={toggleLanguage}>
          <Languages width={22} height={22} aria-hidden="true" />
          {t('auth.langName')}
        </button>

        <div className="identity-layout__hero-text">
          <h2 className="identity-layout__hero-title">{t('auth.heroTitle')}</h2>
          <p className="identity-layout__hero-subtitle">{t('auth.heroSubtitle')}</p>
        </div>
      </aside>
    </div>
  );
}
