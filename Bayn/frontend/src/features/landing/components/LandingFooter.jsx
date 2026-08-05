import { useTranslation } from 'react-i18next';
import { useLangNavigate, useLangSwitch } from '@/shared/hooks/useLang';
import Globe from '@/assets/icons/globe.svg?react';
import BrandMark from './BrandMark';
import './LandingFooter.css';

export default function LandingFooter() {
  const { t, i18n } = useTranslation();
  const navigate = useLangNavigate();
  const toggleLang = useLangSwitch();

  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-about">
            <div className="brand">
              <BrandMark />
              <span className="name">Beyn</span>
            </div>
            <p>{t('landing.footer.about')}</p>
          </div>
          <div className="foot-col">
            <h4>{t('landing.footer.product')}</h4>
            <a href="#features">{t('landing.footer.features')}</a>
            <a href="#marketplace">{t('landing.footer.marketplace')}</a>
            <a href="#dashboard">{t('landing.footer.dashboard')}</a>
            <a href="#nda">{t('landing.footer.nda')}</a>
          </div>
          <div className="foot-col">
            <h4>{t('landing.footer.company')}</h4>
            <a href="#top">{t('landing.footer.aboutLink')}</a>
            <a href="#top">{t('landing.footer.contact')}</a>
          </div>
          <div className="foot-col">
            <h4>{t('landing.footer.resources')}</h4>
            <a href="#top">{t('landing.footer.help')}</a>
            <a
              href={`/${i18n.language}/privacy`}
              onClick={(e) => { e.preventDefault(); navigate('/privacy', { state: { crumb: { label: 'الرئيسية', to: '/' } } }); }}
            >
              {t('landing.footer.privacy')}
            </a>
            <a
              href={`/${i18n.language}/terms`}
              onClick={(e) => { e.preventDefault(); navigate('/terms', { state: { crumb: { label: 'الرئيسية', to: '/' } } }); }}
            >
              {t('landing.footer.terms')}
            </a>
          </div>
        </div>
        <div className="foot-bottom">
          <span>{t('landing.footer.rights')}</span>
          <button type="button" className="foot-lang" onClick={toggleLang} title="Language">
            <Globe width={16} height={16} aria-hidden="true" />
            <span>{i18n.language === 'ar' ? 'English' : 'العربية'}</span>
          </button>
          <div className="socials">
            <a href="https://x.com/Beyn_sa" target="_blank" rel="noreferrer" aria-label="X"><svg width="16" height="16" viewBox="0 0 24 24" fill="#ebe5dc"><path d="M18.9 2H22l-7 8 8.3 11h-6.5l-5-6.6L6 21H2.9l7.5-8.6L2 2h6.6l4.6 6.1L18.9 2zm-1.1 17h1.8L7.3 3.9H5.4L17.8 19z" /></svg></a>
            <a href="#top" aria-label="LinkedIn"><svg width="16" height="16" viewBox="0 0 24 24" fill="#ebe5dc"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM10 9h3.8v1.7h.1c.5-.9 1.8-1.9 3.7-1.9 4 0 4.7 2.6 4.7 6V21h-4v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21h-4z" /></svg></a>
            <a href="https://www.instagram.com/beyn_sa/" target="_blank" rel="noreferrer" aria-label="Instagram"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ebe5dc" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="#ebe5dc" stroke="none" /></svg></a>
          </div>
        </div>
      </div>
    </footer>
  );
}
