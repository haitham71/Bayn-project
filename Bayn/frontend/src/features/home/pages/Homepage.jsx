import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Headset from '@/assets/icons/headset.svg?react';
import './Homepage.css';

// Per-meeting presentation data (colours + attendee initials) that sits on top
// of the translated schedule entries.
const MEETING_STYLES = [
  { accent: '#3b82f7', tint: 'rgba(222, 235, 255, 0.5)', people: ['A', 'M', 'K'] },
  { accent: '#21b07d', tint: 'rgba(217, 245, 235, 0.5)', people: ['J', 'S', 'R'], extra: 1 },
  { accent: '#f59121', tint: 'rgba(255, 237, 217, 0.5)', people: ['E', 'B'] },
  { accent: '#944ae3', tint: 'rgba(240, 227, 255, 0.5)', people: ['N', 'P', 'L'], extra: 2 },
];

const AVATAR_COLORS = ['#0f3d2e', '#295e4d', '#5ca18a', '#c9baa1', '#463e31'];

function greetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'greetMorning';
  if (hour < 18) return 'greetAfternoon';
  return 'greetEvening';
}

export default function HomePage({ onNavigate }) {
  const { t, i18n } = useTranslation();

  const greeting = t(`home.${greetingKey()}`);
  const dateLabel = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar' : 'en', {
    month: 'long',
    day: 'numeric',
  }).format(new Date());
  const schedule = t('home.schedule', { returnObjects: true });

  const pills = [
    { key: 'requests', label: t('home.requests') },
    { key: 'projects', label: t('home.projects') },
    { key: 'meeting', label: t('home.meeting') },
  ];

  const tiles = [
    t('home.teamLabel'),
    t('home.progressLabel'),
    t('home.statusLabel'),
  ];

  return (
    <div className="home">
      <Sidebar activeKey="home" onNavigate={onNavigate} />

      <div className="home__main">
        <Navbar userName={t('home.profileName')} />

        <main className="home__body">
          <header className="home__header">
            <div className="home__greeting">
              <h1 className="home__title">
                {greeting} {t('home.greetName')}!
              </h1>
              <p className="home__subtitle">{t('home.sub')}</p>
            </div>

            <div className="home__actions">
              {pills.map((pill) => (
                <button key={pill.key} type="button" className="home__pill">
                  {pill.label}
                </button>
              ))}
              <button type="button" className="home__pill home__pill--primary">
                {t('home.createIdea')}
              </button>
            </div>
          </header>

          <div className="home__grid">
            <section className="home__col-main">
              <div className="home__cards">
                {tiles.map((label) => (
                  <article key={label} className="home__card">
                    <h2 className="home__card-title">{label}</h2>
                    <div className="home__card-body" />
                  </article>
                ))}
              </div>

              <article className="home__card home__card--calendar">
                <h2 className="home__card-title">{t('home.recLabel')}</h2>
                <div className="home__card-body" />
              </article>
            </section>

            <aside className="home__col-side">
              <section className="home__schedule" aria-label={t('home.scheduleTitle')}>
                <header className="home__schedule-head">
                  <h2 className="home__schedule-title">{t('home.scheduleTitle')}</h2>
                  <span className="home__schedule-date">{dateLabel}</span>
                </header>

                <ul className="home__schedule-list">
                  {schedule.map((item, i) => {
                    const style = MEETING_STYLES[i % MEETING_STYLES.length];
                    return (
                      <li
                        key={item.name}
                        className="home__meeting"
                        style={{ '--accent': style.accent, '--tint': style.tint }}
                      >
                        <span className="home__meeting-time">{item.time}</span>
                        <span className="home__meeting-name">{item.name}</span>
                        <div className="home__meeting-people">
                          {style.people.map((initial, pi) => (
                            <span
                              key={pi}
                              className="home__meeting-avatar"
                              style={{ background: AVATAR_COLORS[pi % AVATAR_COLORS.length] }}
                            >
                              {initial}
                            </span>
                          ))}
                          {style.extra ? (
                            <span className="home__meeting-extra">+{style.extra}</span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </aside>
          </div>
        </main>
      </div>

      <button type="button" className="home__support" aria-label={t('home.support')}>
        <Headset width={24} height={24} aria-hidden="true" />
      </button>
    </div>
  );
}
