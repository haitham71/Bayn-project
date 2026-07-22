import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLangNavigate, useLangSwitch } from '@/shared/hooks/useLang';
import { getAnalyticsOverview } from '../services/analyticsService';
import BaynLogo from '@/assets/logo/Bayn-svg.svg?react';
import ArrowRight from '@/assets/icons/arrow-right.svg?react';
import Check from '@/assets/icons/check.svg?react';
import Globe from '@/assets/icons/globe.svg?react';
import Lightbulb from '@/assets/icons/lightbulb.svg?react';
import Users from '@/assets/icons/users.svg?react';
import LayoutDashboard from '@/assets/icons/layout-dashboard.svg?react';
import Calendar from '@/assets/icons/calendar.svg?react';
import User from '@/assets/icons/user.svg?react';
import './LandingPage.css';

function Logo() {
  return <BaynLogo className="logo" aria-hidden="true" />;
}

function Tick() {
  return (
    <span className="tick">
      <Check width={13} height={13} aria-hidden="true" />
    </span>
  );
}

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useLangNavigate();
  const toggleLang = useLangSwitch();
  const rootRef = useRef(null);
  const [stats, setStats] = useState({ users: 0, ideas: 0, teams: 0 });
  // Always Western digits — the big display font may not carry Arabic-Indic
  // glyphs, and the stat numbers read cleaner in Latin either way.
  const fmt = (n) => new Intl.NumberFormat('en-US').format(n || 0);

  // Public platform counts for the hero + stats band.
  useEffect(() => {
    getAnalyticsOverview()
      .then((d) => setStats({ users: d.users || 0, ideas: d.ideas || 0, teams: d.teams || 0 }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    // Themed page scrollbar while the landing is showing.
    document.documentElement.classList.add('bayn-scroll');

    const hdr = root.querySelector('#lp-hdr');
    const onScroll = () => hdr && hdr.classList.toggle('scrolled', window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const reveals = root.querySelectorAll('.reveal');
    let io;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
      reveals.forEach((el, i) => { el.style.transitionDelay = `${Math.min(i % 3, 3) * 70}ms`; io.observe(el); });
    } else {
      reveals.forEach((el) => el.classList.add('in'));
    }

    return () => {
      document.documentElement.classList.remove('bayn-scroll');
      window.removeEventListener('scroll', onScroll);
      if (io) io.disconnect();
    };
  }, []);

  return (
    <div className="lp" ref={rootRef}>
      {/* ===== NAV ===== */}
      <header id="lp-hdr">
        <div className="wrap">
          <nav>
            <a href="#top" className="brand" aria-label="Bayn home">
              <Logo />
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

      {/* ===== HERO ===== */}
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
                <div className="m"><b>{fmt(stats.users)}</b><span>{t('landing.hero.metaBuilders')}</span></div>
                <div className="m"><b>{fmt(stats.ideas)}</b><span>{t('landing.hero.metaIdeas')}</span></div>
                <div className="m"><b>{fmt(stats.teams)}</b><span>{t('landing.hero.metaTeams')}</span></div>
              </div>
            </div>

            <div className="hero-visual reveal">
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
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="section" id="features">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="eyebrow" style={{ justifyContent: 'center' }}>{t('landing.features.eyebrow')}</span>
            <h2>{t('landing.features.title')}</h2>
            <p className="lead">{t('landing.features.lead')}</p>
          </div>
          <div className="features">
            <div className="card reveal">
              <div className="ico"><Lightbulb width={24} height={24} aria-hidden="true" /></div>
              <h3>{t('landing.features.marketplaceTitle')}</h3>
              <p>{t('landing.features.marketplaceDesc')}</p>
            </div>
            <div className="card reveal">
              <div className="ico"><Users width={24} height={24} aria-hidden="true" /></div>
              <h3>{t('landing.features.teamTitle')}</h3>
              <p>{t('landing.features.teamDesc')}</p>
            </div>
            <div className="card reveal">
              <div className="ico"><LayoutDashboard width={24} height={24} aria-hidden="true" /></div>
              <h3>{t('landing.features.dashboardTitle')}</h3>
              <p>{t('landing.features.dashboardDesc')}</p>
            </div>
            <div className="card reveal">
              <div className="ico"><Calendar width={24} height={24} aria-hidden="true" /></div>
              <h3>{t('landing.features.meetingsTitle')}</h3>
              <p>{t('landing.features.meetingsDesc')}</p>
            </div>
            <div className="card reveal">
              <div className="ico"><User width={24} height={24} aria-hidden="true" /></div>
              <h3>{t('landing.features.profilesTitle')}</h3>
              <p>{t('landing.features.profilesDesc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
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

      {/* ===== SHOWCASE 1 (Marketplace) ===== */}
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

      {/* ===== STATS BAND ===== */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="band reveal">
            <div className="band-glow" />
            <div className="wrapx">
              <div className="band-stat"><b>{fmt(stats.users)}</b><span>{t('landing.stats.builders')}</span></div>
              <div className="band-stat"><b>{fmt(stats.ideas)}</b><span>{t('landing.stats.ideas')}</span></div>
              <div className="band-stat"><b>{fmt(stats.teams)}</b><span>{t('landing.stats.teams')}</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SHOWCASE 2 (Dashboard) — panel first to alternate the layout ===== */}
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

      {/* ===== CTA ===== */}
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

      {/* ===== FOOTER ===== */}
      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-about">
              <div className="brand">
                <Logo />
                <span className="name">Bayn</span>
              </div>
              <p>{t('landing.footer.about')}</p>
            </div>
            <div className="foot-col">
              <h4>{t('landing.footer.product')}</h4>
              <a href="#features">{t('landing.footer.features')}</a>
              <a href="#marketplace">{t('landing.footer.marketplace')}</a>
              <a href="#dashboard">{t('landing.footer.dashboard')}</a>
            </div>
            <div className="foot-col">
              <h4>{t('landing.footer.company')}</h4>
              <a href="#top">{t('landing.footer.aboutLink')}</a>
              <a href="#top">{t('landing.footer.contact')}</a>
            </div>
            <div className="foot-col">
              <h4>{t('landing.footer.resources')}</h4>
              <a href="#top">{t('landing.footer.help')}</a>
              <a href="#top">{t('landing.footer.privacy')}</a>
              <a href="#top">{t('landing.footer.terms')}</a>
            </div>
          </div>
          <div className="foot-bottom">
            <span>{t('landing.footer.rights')}</span>
            <button type="button" className="foot-lang" onClick={toggleLang} title="Language">
              <Globe width={16} height={16} aria-hidden="true" />
              <span>{i18n.language === 'ar' ? 'English' : 'العربية'}</span>
            </button>
            <div className="socials">
              <a href="#top" aria-label="X"><svg width="16" height="16" viewBox="0 0 24 24" fill="#ebe5dc"><path d="M18.9 2H22l-7 8 8.3 11h-6.5l-5-6.6L6 21H2.9l7.5-8.6L2 2h6.6l4.6 6.1L18.9 2zm-1.1 17h1.8L7.3 3.9H5.4L17.8 19z" /></svg></a>
              <a href="#top" aria-label="LinkedIn"><svg width="16" height="16" viewBox="0 0 24 24" fill="#ebe5dc"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM10 9h3.8v1.7h.1c.5-.9 1.8-1.9 3.7-1.9 4 0 4.7 2.6 4.7 6V21h-4v-5.3c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V21h-4z" /></svg></a>
              <a href="#top" aria-label="Instagram"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ebe5dc" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="#ebe5dc" stroke="none" /></svg></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
