import { useTranslation } from 'react-i18next';
import { useLangNavigate } from '@/shared/hooks/useLang';
import BrandMark from './BrandMark';
import './LandingNav.css';

// Sticky top bar. The shadow-on-scroll state is toggled by useLandingMotion,
// which finds this header by its id.
export default function LandingNav() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();

  return (
    <header id="lp-hdr">
      <div className="wrap">
        <nav>
          <a href="#top" className="brand" aria-label="Beyn home">
            <BrandMark />
          </a>
          <div className="navlinks">
            <a href="#features">{t('landing.nav.features')}</a>
            <a href="#how">{t('landing.nav.how')}</a>
            <a href="#marketplace">{t('landing.nav.marketplace')}</a>
          </div>
          <div className="navcta">
            <button type="button" className="login-link" onClick={() => navigate('/login')}>{t('landing.nav.login')}</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/signup')}>{t('landing.nav.getStarted')}</button>
          </div>
        </nav>
      </div>
    </header>
  );
}
