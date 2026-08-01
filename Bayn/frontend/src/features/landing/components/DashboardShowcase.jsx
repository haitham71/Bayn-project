import { useTranslation } from 'react-i18next';
import Tick from './Tick';
import './MockPanel.css';
import './Showcase.css';

// Panel first, so this showcase mirrors the marketplace one above it.
export default function DashboardShowcase() {
  const { t } = useTranslation();

  return (
    <section className="section" style={{ paddingTop: 0 }} id="dashboard">
      <div className="wrap">
        <div className="showcase-grid">
          <div className="panel reveal">
            <div className="mk-head">
              <div><div className="mk-title">{t('landing.dash.thisWeek')}</div><div className="mk-sub">{t('landing.dash.thisWeekMeta')}</div></div>
            </div>
            <div className="mk-rows">
              <div className="mk-row"><div className="mk-av" style={{ background: '#295e4d' }}>✓</div><div className="t"><b>{t('landing.dash.review')}</b><span>{t('landing.dash.reviewMeta')}</span></div><span className="mk-tag">{t('landing.dash.done')}</span></div>
              <div className="mk-row"><div className="mk-av" style={{ background: '#0f3d2e' }}>·</div><div className="t"><b>{t('landing.dash.planning')}</b><span>{t('landing.dash.planningMeta')}</span></div><span className="mk-tag">{t('landing.dash.soon')}</span></div>
              <div className="mk-row"><div className="mk-av" style={{ background: '#786c57' }}>·</div><div className="t"><b>{t('landing.dash.investor')}</b><span>{t('landing.dash.investorMeta')}</span></div><span className="mk-tag">{t('landing.dash.soon')}</span></div>
            </div>
            <div className="idea-card" style={{ marginTop: '12px', marginBottom: 0 }}>
              <div className="idea-top"><b>{t('landing.dash.milestone')}</b><span className="chip">72%</span></div>
              <div className="mk-bar"><i style={{ width: '72%' }} /></div>
            </div>
          </div>
          <div className="reveal">
            <span className="eyebrow">{t('landing.dash.eyebrow')}</span>
            <h2 style={{ margin: '14px 0 4px' }}>{t('landing.dash.title')}</h2>
            <p className="lead">{t('landing.dash.lead')}</p>
            <ul className="feat-list">
              <li><Tick />{t('landing.dash.point1')}</li>
              <li><Tick />{t('landing.dash.point2')}</li>
              <li><Tick />{t('landing.dash.point3')}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
