import { useTranslation } from 'react-i18next';
import { useNow } from '@/shared/hooks/useNow';
import { canJoin, minutesUntilOpen } from '@/features/meetings/lib/joinWindow';
import './UpcomingMeetings.css';

const ACCENTS = [
  { accent: '#3b82f7', tint: 'rgba(222, 235, 255, 0.5)' },
  { accent: '#21b07d', tint: 'rgba(217, 245, 235, 0.5)' },
  { accent: '#f59121', tint: 'rgba(255, 237, 217, 0.5)' },
  { accent: '#944ae3', tint: 'rgba(240, 227, 255, 0.5)' },
];

const AVATAR_COLORS = ['#0f3d2e', '#295e4d', '#5ca18a', '#c9baa1', '#463e31'];
const MAX_AVATARS = 3;

function People({ participants, locale }) {
  const people = participants || [];
  if (people.length === 0) return null;
  const shown = people.slice(0, MAX_AVATARS);
  const extra = people.length - shown.length;

  return (
    <div className="um__people">
      {shown.map((p, pi) => {
        const name = ((locale === 'ar' ? p.name_ar : p.name_en) || '').trim();
        return (
          <span key={p.id} className="um__person">
            {p.avatar_url ? (
              <img className="um__avatar um__avatar--img" src={p.avatar_url} alt="" />
            ) : (
              <span className="um__avatar" style={{ background: AVATAR_COLORS[pi % AVATAR_COLORS.length] }}>
                {name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="um__tooltip" role="tooltip">{name}</span>
          </span>
        );
      })}
      {extra > 0 && <span className="um__extra">+{extra}</span>}
    </div>
  );
}

// The upcoming-meetings list, same behaviour as the home page: not-yet-ended
// meetings soonest first, attendee avatars, and a join link once the room opens.
export default function UpcomingMeetings({ meetings = [] }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';
  const now = useNow();

  const upcoming = meetings
    .filter((m) => new Date(m.end_time).getTime() >= now)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 20);

  const fmtTime = (iso) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const fmtDay = (iso) => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));

  if (upcoming.length === 0) {
    return <p className="um__empty">{t('home.noMeetings')}</p>;
  }

  return (
    <ul className="um__list bayn-scroll">
      {upcoming.map((m, i) => {
        const style = ACCENTS[i % ACCENTS.length];
        return (
          <li key={m.id} className="um__meeting" style={{ '--accent': style.accent, '--tint': style.tint }}>
            <span className="um__time">{fmtDay(m.start_time)} · {fmtTime(m.start_time)}</span>
            <span className="um__name">{m.title || t('home.meeting')}</span>
            <People participants={m.participants} locale={locale} />
            {m.video_link && (canJoin(m, now) ? (
              <button
                type="button"
                className="um__join"
                onClick={() => window.open(`/meeting/${m.id}`, '_blank')}
              >
                {t('home.joinMeeting')}
              </button>
            ) : (
              <span className="um__locked">
                {minutesUntilOpen(m, now) <= 60
                  ? t('meetings.opensIn', { mins: minutesUntilOpen(m, now) })
                  : t('meetings.opensSoon')}
              </span>
            ))}
          </li>
        );
      })}
    </ul>
  );
}
