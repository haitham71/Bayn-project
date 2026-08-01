import { useTranslation } from 'react-i18next';
import Tick from './Tick';
import './MockPanel.css';
import './Showcase.css';

export default function MarketplaceShowcase() {
  const { t } = useTranslation();

  return (
    <section className="section" id="marketplace">
      <div className="wrap">
        <div className="showcase-grid">
          <div className="reveal">
            <span className="eyebrow">{t('landing.market.eyebrow')}</span>
            <h2 style={{ margin: '14px 0 4px' }}>{t('landing.market.title')}</h2>
            <p className="lead">{t('landing.market.lead')}</p>
            <ul className="feat-list">
              <li><Tick />{t('landing.market.point1')}</li>
              <li><Tick />{t('landing.market.point2')}</li>
              <li><Tick />{t('landing.market.point3')}</li>
            </ul>
          </div>
          <div className="panel reveal">
            <div className="idea-card">
              <div className="idea-top"><b>{t('landing.market.idea1Title')}</b><span className="chip">{t('landing.market.recruiting')}</span></div>
              <p>{t('landing.market.idea1Desc')}</p>
              <div className="idea-foot">
                <div className="stack">
                  <span className="a" style={{ background: '#295e4d' }}>AK</span>
                  <span className="a" style={{ background: '#786c57' }}>LM</span>
                  <span className="a" style={{ background: '#0f3d2e' }}>YR</span>
                </div>
                <span className="join">{t('landing.market.join')} →</span>
              </div>
            </div>
            <div className="idea-card">
              <div className="idea-top"><b>{t('landing.market.idea2Title')}</b><span className="chip alt">{t('landing.market.early')}</span></div>
              <p>{t('landing.market.idea2Desc')}</p>
              <div className="idea-foot">
                <div className="stack">
                  <span className="a" style={{ background: '#0f3d2e' }}>MS</span>
                  <span className="a" style={{ background: '#295e4d' }}>RD</span>
                </div>
                <span className="join">{t('landing.market.join')} →</span>
              </div>
            </div>
            <div className="idea-card">
              <div className="idea-top"><b>{t('landing.market.idea3Title')}</b><span className="chip">{t('landing.market.recruiting')}</span></div>
              <p>{t('landing.market.idea3Desc')}</p>
              <div className="idea-foot">
                <div className="stack">
                  <span className="a" style={{ background: '#786c57' }}>NF</span>
                  <span className="a" style={{ background: '#295e4d' }}>HA</span>
                  <span className="a" style={{ background: '#0f3d2e' }}>SA</span>
                </div>
                <span className="join">{t('landing.market.join')} →</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
