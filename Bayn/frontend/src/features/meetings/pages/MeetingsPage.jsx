import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useNow } from '@/shared/hooks/useNow';
import { listMeetings } from '@/features/meetings/services/meetingService';
import { canJoin, minutesUntilOpen } from '@/features/meetings/lib/joinWindow';
import Video from '@/assets/icons/video.svg?react';
import './MeetingsPage.css';

const WEEK_MS = 7 * 86400000;

export default function MeetingsPage({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const { fullName } = useCurrentUser();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  const [meetings, setMeetings] = useState([]);
  const [tab, setTab] = useState('upcoming');

  useEffect(() => {
    listMeetings().then((rows) => setMeetings(rows || [])).catch(() => {});
  }, []);

  const now = useNow();
  const upcoming = meetings
    .filter((m) => new Date(m.end_time).getTime() >= now)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  const past = meetings
    .filter((m) => new Date(m.end_time).getTime() < now)
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

  // Upcoming split into "this week" and "later".
  const weekCutoff = now + WEEK_MS;
  const thisWeek = upcoming.filter((m) => new Date(m.start_time).getTime() <= weekCutoff);
  const later = upcoming.filter((m) => new Date(m.start_time).getTime() > weekCutoff);

  const tabs = [
    { key: 'upcoming', label: t('meetings.tabUpcoming'), count: upcoming.length },
    { key: 'past', label: t('meetings.tabPast'), count: past.length },
  ];

  const dayNum = (iso) => new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(new Date(iso));
  const monthShort = (iso) => new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(iso));
  const timeRange = (m) => {
    const time = (d) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(d));
    return `${time(m.start_time)} – ${time(m.end_time)}`;
  };

  function Row({ m, joinable }) {
    // The room only opens shortly before the start time, so an upcoming meeting
    // still shows a locked button until then.
    let joinCell;
    if (!joinable || !m.video_link) {
      joinCell = <span className="mt__ended">{joinable ? '' : t('meetings.ended')}</span>;
    } else if (canJoin(m, now)) {
      joinCell = (
        <a className="mt__join" href={m.video_link} target="_blank" rel="noopener noreferrer">
          <Video width={18} height={18} aria-hidden="true" />
          {t('meetings.join')}
        </a>
      );
    } else {
      const mins = minutesUntilOpen(m, now);
      joinCell = (
        <span className="mt__join mt__join--locked">
          <Video width={18} height={18} aria-hidden="true" />
          {mins <= 60 ? t('meetings.opensIn', { mins }) : t('meetings.opensSoon')}
        </span>
      );
    }

    return (
      <li className="mt__row">
        <span className="mt__date" aria-hidden="true">
          <span className="mt__date-day">{dayNum(m.start_time)}</span>
          <span className="mt__date-month">{monthShort(m.start_time)}</span>
        </span>

        <div className="mt__info">
          <div className="mt__info-head">
            <span className="mt__title">{m.title || t('meetings.meeting')}</span>
            <span className="mt__status">{t('meetings.confirmed')}</span>
          </div>
          <p className="mt__meta">
            {timeRange(m)}
            {m.video_link ? ` · ${t('meetings.dailyRoom')}` : ''}
          </p>
        </div>

        <div className="mt__people">
          {(m.participants || []).slice(0, 3).map((p) => {
            const name = (locale === 'ar' ? p.name_ar : p.name_en) || '';
            return (
              <span key={p.id} className="mt__person">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="mt__avatar mt__avatar--img" />
                ) : (
                  <span className="mt__avatar">{name.trim().charAt(0).toUpperCase()}</span>
                )}
                <span className="mt__tooltip" role="tooltip">{name}</span>
              </span>
            );
          })}
        </div>

        {joinCell}
      </li>
    );
  }

  return (
    <div className="mt">
      <Sidebar activeKey="meetings" onNavigate={onNavigate} />

      <div className="mt__main">
        <Navbar userName={fullName} />

        <main className="mt__body">
          <header className="mt__header">
            <h1 className="mt__page-title">{t('meetings.title')}</h1>
            <p className="mt__page-sub">{t('meetings.subtitle')}</p>
          </header>

          <div className="mt__tabs" role="tablist">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                type="button"
                role="tab"
                aria-selected={tab === tb.key}
                className={`mt__tab${tab === tb.key ? ' mt__tab--active' : ''}`}
                onClick={() => setTab(tb.key)}
              >
                {tb.label} <span className="mt__tab-count">{tb.count}</span>
              </button>
            ))}
          </div>

          {tab === 'upcoming' ? (
            upcoming.length === 0 ? (
              <p className="mt__empty">{t('meetings.empty')}</p>
            ) : (
              <>
                {thisWeek.length > 0 && (
                  <section className="mt__group">
                    <h2 className="mt__group-title">{t('meetings.thisWeek')}</h2>
                    <ul className="mt__list">
                      {thisWeek.map((m) => <Row key={m.id} m={m} joinable />)}
                    </ul>
                  </section>
                )}
                {later.length > 0 && (
                  <section className="mt__group">
                    <h2 className="mt__group-title">{t('meetings.later')}</h2>
                    <ul className="mt__list">
                      {later.map((m) => <Row key={m.id} m={m} joinable />)}
                    </ul>
                  </section>
                )}
              </>
            )
          ) : past.length === 0 ? (
            <p className="mt__empty">{t('meetings.empty')}</p>
          ) : (
            <ul className="mt__list">
              {past.map((m) => <Row key={m.id} m={m} joinable={false} />)}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}
