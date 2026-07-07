import { useTranslation } from 'react-i18next';
import Button from '@/shared/components/Button';
import logoUrl from '@/assets/logo/Bayn-svg.svg?url';
import './HomePage.css';

/* ─── Meeting colour palette (shared across both languages) ── */
const MEETING_COLORS = [
  { borderColor: '#3B82F6', bgColor: 'rgba(59,130,246,0.09)',   avColors: ['#0F3D2E','#3B82F6','#F97316'], extra: 0 },
  { borderColor: '#10B981', bgColor: 'rgba(16,185,129,0.09)',   avColors: ['#0F3D2E','#3B82F6','#F97316'], extra: 1 },
  { borderColor: '#F97316', bgColor: 'rgba(249,115,22,0.09)',   avColors: ['#0F3D2E','#3B82F6'],           extra: 0 },
  { borderColor: '#8B5CF6', bgColor: 'rgba(139,92,246,0.09)',   avColors: ['#0F3D2E','#3B82F6','#F97316'], extra: 2 },
];

/* ─── Icons ─────────────────────────────────────────────── */
const BellIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const MessageIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* Sidebar nav icons */
const NavHome     = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
const NavBulb     = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="9" y1="18" x2="15" y2="18" /><line x1="10" y1="22" x2="14" y2="22" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" /></svg>;
const NavMonitor  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>;
const NavUserPlus = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg>;
const NavUser     = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const NavSettings = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
const NavGlobe    = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
const NavLogout   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
const HeadsetIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" /><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>;

/* ─── Component ─────────────────────────────────────────── */
export default function HomePage({ onNavigate }) {
  const { t, i18n } = useTranslation();

  const isRtl  = i18n.dir() === 'rtl';
  const toggleLang = () => i18n.changeLanguage(isRtl ? 'en' : 'ar');

  // Merge translated schedule names with shared colour palette
  const schedule = (t('home.schedule', { returnObjects: true }) || []).map(
    (item, idx) => ({ ...MEETING_COLORS[idx], ...item })
  );

  const hour = new Date().getHours();
  const greetKey = hour < 12 ? 'greetMorning' : hour < 17 ? 'greetAfternoon' : 'greetEvening';

  const today = new Date();
  const dateLabel = today.toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
    month: 'long',
    day:   'numeric',
  });

  return (
    <div className={`hp${isRtl ? ' hp--rtl' : ''}`} dir={i18n.dir()}>

      {/* ── Main ── */}
      <div className="hp__main">

        {/* Topbar */}
        <header className="hp__topbar">
          <button className="hp__user-btn" type="button">
            <span className="hp__avatar-circle" />
            <span className="hp__user-name">User</span>
            <ChevronIcon />
          </button>

          <button className="hp__icon-btn" type="button" aria-label="Notifications">
            <BellIcon />
            <span className="hp__notif-dot" />
          </button>

          <button className="hp__icon-btn" type="button" aria-label="Messages">
            <MessageIcon />
            <span className="hp__notif-dot" />
          </button>

          <div className="hp__search" role="search">
            <span className="hp__search-placeholder">{t('home.search')}</span>
            <SearchIcon />
          </div>

          <img src={logoUrl} alt="Bayn" className="hp__logo" />
        </header>

        {/* Content */}
        <div className="hp__content">

          {/* Greeting + action pills */}
          <div className="hp__top-row">
            <div>
              <h1 className="hp__greeting">{t(`home.${greetKey}`)}, User!</h1>
              <p className="hp__greeting-sub">{t('home.sub')}</p>
            </div>
            <div className="hp__pills">
              <button className="hp__pill" type="button">{t('home.requests')}</button>
              <button className="hp__pill" type="button">{t('home.projects')}</button>
              <button className="hp__pill" type="button">{t('home.meeting')}</button>

              {/* Primary action — Bayn Button component */}
              <Button variant="primary" size="sm" className="hp__pill-btn">
                {t('home.createIdea')}
              </Button>
            </div>
          </div>

          {/* Cards grid */}
          <div className="hp__grid">

            {/* ── Today's Schedule (tall) ── */}
            <div className="hp__card hp__card--schedule">
              <div className="hp__sched-hd">
                <span className="hp__sched-title">{t('home.scheduleTitle')}</span>
                <span className="hp__sched-date">{dateLabel}</span>
              </div>

              <div className="hp__sched-list">
                {schedule.map((item, i) => (
                  <div
                    key={i}
                    className="hp__meeting"
                    style={{ '--m-border': item.borderColor, '--m-bg': item.bgColor }}
                  >
                    <span className="hp__meeting-time">{item.time}</span>
                    <div className="hp__meeting-body">
                      <div className="hp__meeting-name">{item.name}</div>
                      <div className="hp__meeting-avs">
                        {item.avColors.map((c, j) => (
                          <span key={j} className="hp__av" style={{ background: c }} />
                        ))}
                        {item.extra > 0 && (
                          <span className="hp__av-extra">+{item.extra}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Placeholder cards ── */}
            <div className="hp__card hp__card--ph">
              <span className="hp__ph-label">{t('home.teamLabel')}</span>
            </div>
            <div className="hp__card hp__card--ph">
              <span className="hp__ph-label">{t('home.progressLabel')}</span>
            </div>
            <div className="hp__card hp__card--ph">
              <span className="hp__ph-label">{t('home.statusLabel')}</span>
            </div>

            {/* ── Recommended (wide) ── */}
            <div className="hp__card hp__card--ph hp__card--wide">
              <span className="hp__ph-label">{t('home.recLabel')}</span>
            </div>

          </div>
        </div>
      </div>

      {/* ── Right sidebar ── */}
      <aside className="hp__sidebar">
        <button type="button" className="hp__nav-btn hp__nav-btn--active" aria-label="Home">
          <NavHome />
        </button>
        <button type="button" className="hp__nav-btn" aria-label="Ideas">
          <NavBulb />
        </button>
        <button type="button" className="hp__nav-btn" aria-label="Studio">
          <NavMonitor />
        </button>
        <button type="button" className="hp__nav-btn" aria-label="Requests">
          <NavUserPlus />
        </button>
        <button type="button" className="hp__nav-btn" aria-label="Profile">
          <NavUser />
        </button>
        <button type="button" className="hp__nav-btn" aria-label="Settings">
          <NavSettings />
        </button>

        <div className="hp__nav-bottom">
          <button
            type="button"
            className="hp__nav-btn"
            aria-label="Toggle language"
            onClick={toggleLang}
          >
            <NavGlobe />
          </button>
          <button
            type="button"
            className="hp__nav-btn hp__nav-btn--logout"
            aria-label="Log out"
            onClick={() => onNavigate && onNavigate('login')}
          >
            <NavLogout />
          </button>
        </div>
      </aside>

      {/* Support FAB */}
      <button type="button" className="hp__support-btn" aria-label="Support">
        <HeadsetIcon />
      </button>

    </div>
  );
}
