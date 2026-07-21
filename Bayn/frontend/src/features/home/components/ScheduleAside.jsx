import { useTranslation } from 'react-i18next';
import { useNow } from '@/shared/hooks/useNow';
import { canJoin, minutesUntilOpen } from '@/features/meetings/lib/joinWindow';
import { MEETING_ACCENTS, AVATAR_COLORS, MAX_AVATARS } from '../lib/constants';
import './ScheduleAside.css';

function People({ participants, locale }) {
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
              <img className="home__meeting-avatar home__meeting-avatar--img" src={p.avatar_url} alt="" />
            ) : (
              <span className="home__meeting-avatar" style={{ background: AVATAR_COLORS[pi % AVATAR_COLORS.length] }}>
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

// Right-hand "Today's schedule": upcoming (not-yet-ended) meetings, soonest
// first, with a join button once the room opens.
export default function ScheduleAside({ meetings }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';
  const now = useNow();

  const dateLabel = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(new Date());
  const fmtTime = (iso) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const fmtDay = (iso) => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));

  // The list scrolls, so keep a generous cap rather than a tight one.
  const upcoming = meetings
    .filter((m) => new Date(m.end_time).getTime() >= now)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 20);

  return (
    <aside className="home__col-side">
      <section className="home__schedule" aria-label={t('home.scheduleTitle')}>
        <header className="home__schedule-head">
          <h2 className="home__schedule-title">{t('home.scheduleTitle')}</h2>
          <span className="home__schedule-date">{dateLabel}</span>
        </header>

        {upcoming.length === 0 ? (
          <p className="home__schedule-empty">{t('home.noMeetings')}</p>
        ) : (
          <ul className="home__schedule-list bayn-scroll">
            {upcoming.map((m, i) => {
              const style = MEETING_ACCENTS[i % MEETING_ACCENTS.length];
              return (
                <li key={m.id} className="home__meeting" style={{ '--accent': style.accent, '--tint': style.tint }}>
                  <span className="home__meeting-time">
                    {fmtDay(m.start_time)} · {fmtTime(m.start_time)}
                  </span>
                  <span className="home__meeting-name">{m.title || t('home.meeting')}</span>
                  <People participants={m.participants} locale={locale} />
                  {m.video_link && (canJoin(m, now) ? (
                    <button
                      type="button"
                      className="home__meeting-join"
                      onClick={() => window.open(`/meeting/${m.id}`, '_blank')}
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
  );
}
