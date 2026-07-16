import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Headset from '@/assets/icons/headset.svg?react';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useNow } from '@/shared/hooks/useNow';
import { listMeetings } from '@/features/meetings/services/meetingService';
import { canJoin, minutesUntilOpen } from '@/features/meetings/lib/joinWindow';
import { openJoinLink } from '@/features/meetings/lib/openJoinLink';
import './Homepage.css';

// Accent colours cycled across the upcoming-meeting rows.
const MEETING_ACCENTS = [
  { accent: '#3b82f7', tint: 'rgba(222, 235, 255, 0.5)' },
  { accent: '#21b07d', tint: 'rgba(217, 245, 235, 0.5)' },
  { accent: '#f59121', tint: 'rgba(255, 237, 217, 0.5)' },
  { accent: '#944ae3', tint: 'rgba(240, 227, 255, 0.5)' },
];

const AVATAR_COLORS = ['#0f3d2e', '#295e4d', '#5ca18a', '#c9baa1', '#463e31'];
const MAX_AVATARS = 3;

function greetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'greetMorning';
  if (hour < 18) return 'greetAfternoon';
  return 'greetEvening';
}

export default function HomePage({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const { firstName, fullName } = useCurrentUser();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  const [meetings, setMeetings] = useState([]);
  useEffect(() => {
    listMeetings().then((rows) => setMeetings(rows || [])).catch(() => {});
  }, []);

  const now = useNow();

  // Upcoming (not-yet-ended) meetings, soonest first.
  const upcoming = meetings
    .filter((m) => new Date(m.end_time).getTime() >= now)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 6);

  const fmtTime = (iso) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const fmtDay = (iso) => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));

  const greeting = t(`home.${greetingKey()}`);
  const dateLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
  }).format(new Date());

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

  function People({ participants }) {
    const people = participants || [];
    if (people.length === 0) return null;
    const shown = people.slice(0, MAX_AVATARS);
    const extra = people.length - shown.length;

    return (
      <div className="home__meeting-people">
        {shown.map((p, pi) => {
          const name = ((locale === 'ar' ? p.name_ar : p.name_en) || '').trim();
          return (
            <span key={p.id} className="home__meeting-person">
              {p.avatar_url ? (
                <img
                  className="home__meeting-avatar home__meeting-avatar--img"
                  src={p.avatar_url}
                  alt=""
                />
              ) : (
                <span
                  className="home__meeting-avatar"
                  style={{ background: AVATAR_COLORS[pi % AVATAR_COLORS.length] }}
                >
                  {name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="home__meeting-tooltip" role="tooltip">{name}</span>
            </span>
          );
        })}
        {extra > 0 && <span className="home__meeting-extra">+{extra}</span>}
      </div>
    );
  }

  return (
    <div className="home">
      <Sidebar activeKey="home" onNavigate={onNavigate} />

      <div className="home__main">
        <Navbar userName={fullName || t('home.profileName')} />

        <main className="home__body">
          <header className="home__header">
            <div className="home__greeting">
              <h1 className="home__title">
                {greeting} {firstName || t('home.greetName')}!
              </h1>
              <p className="home__subtitle">{t('home.sub')}</p>
            </div>

            <div className="home__actions">
              {pills.map((pill) => (
                <button key={pill.key} type="button" className="home__pill">
                  {pill.label}
                </button>
              ))}
              <button
                type="button"
                className="home__pill home__pill--primary"
                onClick={() => onNavigate?.('createidea')}
              >
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

                {upcoming.length === 0 ? (
                  <p className="home__schedule-empty">{t('home.noMeetings')}</p>
                ) : (
                  <ul className="home__schedule-list">
                    {upcoming.map((m, i) => {
                      const style = MEETING_ACCENTS[i % MEETING_ACCENTS.length];
                      return (
                        <li
                          key={m.id}
                          className="home__meeting"
                          style={{ '--accent': style.accent, '--tint': style.tint }}
                        >
                          <span className="home__meeting-time">
                            {fmtDay(m.start_time)} · {fmtTime(m.start_time)}
                          </span>
                          <span className="home__meeting-name">{m.title || t('home.meeting')}</span>
                          <People participants={m.participants} />
                          {m.video_link && (canJoin(m, now) ? (
                            <button
                              type="button"
                              className="home__meeting-join"
                              onClick={() => openJoinLink(m.id)}
                            >
                              {t('home.joinMeeting')}
                            </button>
                          ) : (
                            <span className="home__meeting-locked">
                              {minutesUntilOpen(m, now) <= 60
                                ? t('meetings.opensIn', { mins: minutesUntilOpen(m, now) })
                                : t('meetings.opensSoon')}
                            </span>
                          ))}
                        </li>
                      );
                    })}
                  </ul>
                )}
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
