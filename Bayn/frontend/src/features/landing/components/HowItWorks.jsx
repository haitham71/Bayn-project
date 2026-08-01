import { useTranslation } from 'react-i18next';
import './HowItWorks.css';

// The four-step row. useLandingMotion watches the `.steps` container so the
// connector line draws itself; the numbers time their entrance against it in
// CSS, which is why the steps opt out of the shared reveal delay.
export default function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section className="section how" id="how">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="eyebrow" style={{ justifyContent: 'center' }}>{t('landing.how.eyebrow')}</span>
          <h2>{t('landing.how.title')}</h2>
          <p className="lead">{t('landing.how.lead')}</p>
        </div>
        <div className="steps">
          <div className="step reveal"><div className="num">1</div><h3>{t('landing.how.step1Title')}</h3><p>{t('landing.how.step1Desc')}</p></div>
          <div className="step reveal"><div className="num">2</div><h3>{t('landing.how.step2Title')}</h3><p>{t('landing.how.step2Desc')}</p></div>
          <div className="step reveal"><div className="num">3</div><h3>{t('landing.how.step3Title')}</h3><p>{t('landing.how.step3Desc')}</p></div>
          <div className="step reveal"><div className="num">4</div><h3>{t('landing.how.step4Title')}</h3><p>{t('landing.how.step4Desc')}</p></div>
        </div>
      </div>
    </section>
  );
}
