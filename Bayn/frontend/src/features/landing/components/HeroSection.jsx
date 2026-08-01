import { useTranslation } from 'react-i18next';
import { useLangNavigate } from '@/shared/hooks/useLang';
import ArrowRight from '@/assets/icons/arrow-right.svg?react';
import Check from '@/assets/icons/check.svg?react';
import Tilt from './Tilt';
import { fmtCount } from '../lib/format';
import './MockPanel.css';
import './HeroSection.css';

export default function HeroSection({ stats }) {
  const { t } = useTranslation();
  const navigate = useLangNavigate();

  return (
    <section className="hero" id="top">
      <div className="blob a" />
      <div className="blob b" />
      <div className="wrap">
        <div className="hero-grid">
          <div className="hero-copy reveal">
            <span className="eyebrow">{t('landing.hero.eyebrow')}</span>
            <h1>{t('landing.hero.titlePre')}<br /><span className="accent">{t('landing.hero.titleAccent')}</span></h1>
            <p className="lead">{t('landing.hero.lead')}</p>
            <div className="hero-actions">
              <button type="button" className="btn btn-primary" onClick={() => navigate('/signup')}>
                {t('landing.hero.ctaPrimary')}
                <ArrowRight className="arw" width={18} height={18} aria-hidden="true" />
              </button>
              <a href="#how" className="btn btn-ghost">
                {t('landing.hero.ctaSecondary')}
              </a>
            </div>
            <div className="hero-meta">
              <div className="m"><b>{fmtCount(stats.users)}</b><span>{t('landing.hero.metaBuilders')}</span></div>
              <div className="m"><b>{fmtCount(stats.ideas)}</b><span>{t('landing.hero.metaIdeas')}</span></div>
              <div className="m"><b>{fmtCount(stats.teams)}</b><span>{t('landing.hero.metaTeams')}</span></div>
            </div>
          </div>

          <Tilt className="hero-visual reveal">
            <div className="mock">
              <div className="mock-rail">
                <i className="active" /><i /><i /><i /><i />
              </div>
              <div className="mock-inner">
                <div className="mk-head">
                  <div>
                    <div className="mk-title">{t('landing.mock.dashTitle')}</div>
                    <div className="mk-sub">{t('landing.mock.dashSub')}</div>
                  </div>
                  <span className="mk-badge">{t('landing.mock.onTrack')}</span>
                </div>
                <div className="mk-stats">
                  <div className="mk-stat"><b>68%</b><span>{t('landing.mock.progress')}</span><div className="mk-bar"><i style={{ width: '68%' }} /></div></div>
                  <div className="mk-stat"><b>4</b><span>{t('landing.mock.milestones')}</span><div className="mk-bar"><i style={{ width: '50%' }} /></div></div>
                  <div className="mk-stat"><b>5</b><span>{t('landing.mock.members')}</span><div className="mk-bar"><i style={{ width: '83%' }} /></div></div>
                </div>
                <div className="mk-rows">
                  <div className="mk-row">
                    <div className="mk-av" style={{ background: '#295e4d' }}>AS</div>
                    <div className="t"><b>Assad Al-saeed</b><span>{t('landing.mock.roleBackend')}</span></div>
                    <span className="mk-tag">{t('landing.mock.owner')}</span>
                  </div>
                  <div className="mk-row">
                    <div className="mk-av" style={{ background: '#786c57' }}>MK</div>
                    <div className="t"><b>Mohammed Khalid</b><span>{t('landing.mock.roleDesign')}</span></div>
                    <span className="mk-tag">{t('landing.mock.design')}</span>
                  </div>
                  <div className="mk-row">
                    <div className="mk-av" style={{ background: '#0f3d2e' }}>YF</div>
                    <div className="t"><b>Yasser Fahad</b><span>{t('landing.mock.roleMl')}</span></div>
                    <span className="mk-tag">{t('landing.mock.ai')}</span>
                  </div>
                </div>
              </div>
              <div className="float-card">
                <div className="ic">
                  <Check width={20} height={20} aria-hidden="true" />
                </div>
                <div><b>{t('landing.mock.milestoneShipped')}</b><span>{t('landing.mock.milestoneMeta')}</span></div>
              </div>
            </div>
          </Tilt>
        </div>
      </div>
    </section>
  );
}
