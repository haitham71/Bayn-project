import { useTranslation } from 'react-i18next';
import { useLangNavigate } from '@/shared/hooks/useLang';
import ArrowRight from '@/assets/icons/arrow-right.svg?react';
import './CtaSection.css';

export default function CtaSection() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();

  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="cta-panel reveal">
          <h2>{t('landing.cta.title')}</h2>
          <p>{t('landing.cta.lead')}</p>
          <div className="cta-actions">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/signup')}>
              {t('landing.cta.primary')}
              <ArrowRight className="arw" width={18} height={18} aria-hidden="true" />
            </button>
            <a href="#features" className="btn btn-ghost">{t('landing.cta.secondary')}</a>
          </div>
        </div>
      </div>
    </section>
  );
}
