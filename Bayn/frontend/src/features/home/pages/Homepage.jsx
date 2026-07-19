import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Headset from '@/assets/icons/headset.svg?react';
import Flag from '@/assets/icons/flag.svg?react';
import ChevronRight from '@/assets/icons/chevron-right.svg?react';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useNow } from '@/shared/hooks/useNow';
import { listMeetings, listMeetingRequests } from '@/features/meetings/services/meetingService';
import { listProjects, getMyProjects, listProjectMembers } from '@/features/projects/services/projectService';
import { canJoin, minutesUntilOpen } from '@/features/meetings/lib/joinWindow';
import { stageOf } from '@/features/meetings/lib/requestStatus';
import { timeAgo } from '@/shared/lib/relativeTime';
import './Homepage.css';

// Backend ProjectStage values → translated labels (reuses the create-idea keys).
const STAGE_LABEL = {
  planning: 'createIdea.stagePlanning',
  development: 'createIdea.stageDevelopment',
  launching: 'createIdea.stageLaunching',
};

// How many recommended ideas to surface on the home page.
const REC_COUNT = 3;

// Accent colours cycled across the upcoming-meeting rows.
const MEETING_ACCENTS = [
  { accent: '#3b82f7', tint: 'rgba(222, 235, 255, 0.5)' },
  { accent: '#21b07d', tint: 'rgba(217, 245, 235, 0.5)' },
  { accent: '#f59121', tint: 'rgba(255, 237, 217, 0.5)' },
  { accent: '#944ae3', tint: 'rgba(240, 227, 255, 0.5)' },
];

const AVATAR_COLORS = ['#0f3d2e', '#295e4d', '#5ca18a', '#c9baa1', '#463e31'];
const MAX_AVATARS = 3;
// A user can belong to at most this many projects (owner + member) — mirrors
// MyProjectsPage / the backend's MAX_MEMBERSHIPS_PER_USER.
const MAX_PROJECTS = 2;

function greetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'greetMorning';
  if (hour < 18) return 'greetAfternoon';
  return 'greetEvening';
}

export default function HomePage({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { firstName, fullName } = useCurrentUser();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  const [meetings, setMeetings] = useState([]);
  useEffect(() => {
    listMeetings().then((rows) => setMeetings(rows || [])).catch(() => {});
  }, []);

  // A random handful of public ideas for the "recommended" card. Shuffled once
  // on load so it stays put across the per-second clock re-renders.
  const [recIdeas, setRecIdeas] = useState([]);
  useEffect(() => {
    listProjects()
      .then((rows) => {
        const shuffled = [...(rows || [])].sort(() => Math.random() - 0.5);
        setRecIdeas(shuffled.slice(0, REC_COUNT));
      })
      .catch(() => {});
  }, []);

  // "Current team" card: pick one of my projects and show its members.
  const [myProjects, setMyProjects] = useState([]);
  const [teamProjectId, setTeamProjectId] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  // "Application's status" card: join requests for a chosen owned project.
  const [statusProjectId, setStatusProjectId] = useState('');
  const [statusRequests, setStatusRequests] = useState([]);
  useEffect(() => {
    getMyProjects()
      .then((rows) => {
        setMyProjects(rows || []);
        if (rows?.length) setTeamProjectId(rows[0].id);
        const owned = (rows || []).filter((p) => p.role === 'owner');
        if (owned.length) setStatusProjectId(owned[0].id);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!teamProjectId) { setTeamMembers([]); return; }
    listProjectMembers(teamProjectId).then((rows) => setTeamMembers(rows || [])).catch(() => setTeamMembers([]));
  }, [teamProjectId]);
  useEffect(() => {
    if (!statusProjectId) { setStatusRequests([]); return; }
    listMeetingRequests('incoming', statusProjectId)
      .then((rows) => setStatusRequests([...(rows || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))))
      .catch(() => setStatusRequests([]));
  }, [statusProjectId]);

  const teamProject = myProjects.find((p) => p.id === teamProjectId) || null;
  function nextProject() {
    if (myProjects.length < 2) return;
    const i = myProjects.findIndex((p) => p.id === teamProjectId);
    setTeamProjectId(myProjects[(i + 1) % myProjects.length].id);
  }

  const ownedProjects = myProjects.filter((p) => p.role === 'owner');
  // myProjects holds every membership, so its length is what counts toward the cap.
  const atProjectLimit = myProjects.length >= MAX_PROJECTS;
  const statusProject = ownedProjects.find((p) => p.id === statusProjectId) || null;
  function nextStatusProject() {
    if (ownedProjects.length < 2) return;
    const i = ownedProjects.findIndex((p) => p.id === statusProjectId);
    setStatusProjectId(ownedProjects[(i + 1) % ownedProjects.length].id);
  }

  const now = useNow();

  // Upcoming (not-yet-ended) meetings, soonest first. The list scrolls, so keep
  // a generous cap rather than a tight one.
  const upcoming = meetings
    .filter((m) => new Date(m.end_time).getTime() >= now)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 20);

  const fmtTime = (iso) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
  const fmtDay = (iso) => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso));

  const greeting = t(`home.${greetingKey()}`);
  const dateLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    day: 'numeric',
  }).format(new Date());

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
              <button
                type="button"
                className="home__pill"
                onClick={() => onNavigate?.('myprojects')}
              >
                {t('home.projects')}
              </button>
              <button
                type="button"
                className="home__pill home__pill--primary"
                onClick={() => onNavigate?.('createidea')}
                disabled={atProjectLimit}
                title={atProjectLimit ? t('myProjects.limitReached') : undefined}
              >
                {t('home.createIdea')}
              </button>
            </div>
          </header>

          <div className="home__grid">
            <section className="home__col-main">
              <div className="home__cards">
                {/* Current team — pick a project, see who's on it. */}
                <article className="home__card">
                  <h2 className="home__card-title">{t('home.teamLabel')}</h2>
                  <div className="home__card-body">
                    {myProjects.length === 0 ? (
                      <p className="home__team-empty">{t('home.teamEmpty')}</p>
                    ) : (
                      <>
                      <div className="home__team-switch">
                        <span className="home__team-project">{teamProject?.title}</span>
                        {myProjects.length > 1 && (
                          <button
                            type="button"
                            className="home__team-next"
                            onClick={nextProject}
                            aria-label={t('home.teamNext')}
                            title={t('home.teamNext')}
                          >
                            <ChevronRight width={20} height={20} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      <ul className="home__team-list bayn-scroll">
                        {teamMembers.map((mem) => {
                          const name = ((locale === 'ar' ? mem.name_ar : mem.name_en) || '').trim();
                          const specialization = locale === 'ar' ? mem.specialization_ar : mem.specialization_en;
                          return (
                            <li key={mem.user_id} className="home__team-member">
                              {mem.avatar_url ? (
                                <img className="home__team-avatar home__team-avatar--img" src={mem.avatar_url} alt="" />
                              ) : (
                                <span className="home__team-avatar">{name.charAt(0).toUpperCase() || '؟'}</span>
                              )}
                              <span className="home__team-info">
                                <span className="home__team-name">{name || t('home.profileName')}</span>
                                {specialization && <span className="home__team-role">{specialization}</span>}
                              </span>
                              <span className={`home__team-badge${mem.role === 'owner' ? ' home__team-badge--owner' : ''}`}>
                                {t(mem.role === 'owner' ? 'home.roleOwner' : 'home.roleMember')}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      </>
                    )}
                  </div>
                </article>

                {/* Project progress — still a placeholder. */}
                <article className="home__card">
                  <h2 className="home__card-title">{t('home.progressLabel')}</h2>
                  <div className="home__card-body" />
                </article>

                {/* Application's status — latest join requests for a chosen project. */}
                <article className="home__card">
                  <h2 className="home__card-title">{t('home.statusLabel')}</h2>
                  <div className="home__card-body">
                    {ownedProjects.length === 0 ? (
                      <p className="home__team-empty">{t('home.statusNoProjects')}</p>
                    ) : (
                      <>
                        <div className="home__team-switch">
                          <span className="home__team-project">{statusProject?.title}</span>
                          {ownedProjects.length > 1 && (
                            <button
                              type="button"
                              className="home__team-next"
                              onClick={nextStatusProject}
                              aria-label={t('home.teamNext')}
                              title={t('home.teamNext')}
                            >
                              <ChevronRight width={20} height={20} aria-hidden="true" />
                            </button>
                          )}
                        </div>

                        {statusRequests.length === 0 ? (
                          <p className="home__team-empty">{t('home.statusEmpty')}</p>
                        ) : (
                          <ul className="home__status-list bayn-scroll">
                            {statusRequests.slice(0, 8).map((r) => {
                              const name = ((locale === 'ar' ? r.requester?.name_ar : r.requester?.name_en) || '').trim();
                              const stage = stageOf(r);
                              return (
                                <li key={r.id} className="home__status-item">
                                  <span className="home__team-avatar">{name.charAt(0).toUpperCase() || '؟'}</span>
                                  <span className="home__team-info">
                                    <span className="home__team-name">{name || t('home.profileName')}</span>
                                    <span className="home__team-role">{t('joinRequests.applied', { when: timeAgo(r.created_at, locale) })}</span>
                                  </span>
                                  <span className={`home__status-badge home__status-badge--${stage}`}>
                                    {t(`joinRequests.tab.${stage}`)}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                </article>
              </div>

              <article className="home__card home__card--calendar">
                <h2 className="home__card-title">{t('home.recLabel')}</h2>
                <div className="home__card-body">
                  {recIdeas.length === 0 ? (
                    <p className="home__rec-empty">{t('home.recEmpty')}</p>
                  ) : (
                    <div className="home__rec-grid">
                      {recIdeas.map((idea) => {
                        const owner = idea.owner;
                        const ownerName = (owner ? (locale === 'ar' ? owner.name_ar : owner.name_en) : '') || '';
                        return (
                          <button
                            key={idea.id}
                            type="button"
                            className="home__rec-card"
                            onClick={() => navigate(`/ideas/${idea.id}`)}
                          >
                            <span className="home__rec-owner">
                              {owner?.avatar_url ? (
                                <img className="home__rec-avatar home__rec-avatar--img" src={owner.avatar_url} alt="" />
                              ) : (
                                <span className="home__rec-avatar">{ownerName.charAt(0).toUpperCase() || '؟'}</span>
                              )}
                              <span className="home__rec-owner-name">{ownerName || t('home.profileName')}</span>
                            </span>

                            <span className="home__rec-title">{idea.title}</span>

                            <span className="home__rec-stage">
                              <Flag width={13} height={13} aria-hidden="true" />
                              {t(STAGE_LABEL[idea.stage] || STAGE_LABEL.planning)}
                            </span>

                            {idea.skills?.length > 0 && (
                              <span className="home__rec-skills">
                                {idea.skills.slice(0, 3).map((s) => (
                                  <span key={s.id} className="home__rec-skill">{s.name}</span>
                                ))}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                  <ul className="home__schedule-list bayn-scroll">
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
          </div>
        </main>
      </div>

      <button type="button" className="home__support" aria-label={t('home.support')}>
        <Headset width={24} height={24} aria-hidden="true" />
      </button>
    </div>
  );
}
