import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Button from '@/shared/components/Button';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import {
  getMyProjects,
  getProject,
  getProjectTasks,
  getProjectTaskProgress,
} from '@/features/projects/services/projectService';
import {
  listMeetings,
  listMeetingRequests,
  acceptMeetingRequest,
  rejectMeetingRequest,
} from '@/features/meetings/services/meetingService';
import CheckSquare from '@/assets/icons/check-square.svg?react';
import Clock from '@/assets/icons/clock.svg?react';
import Calendar from '@/assets/icons/calendar.svg?react';
import Send from '@/assets/icons/send-horizontal.svg?react';
import Plus from '@/assets/icons/plus.svg?react';
import ChevronDown from '@/assets/icons/chevron-down.svg?react';
import './ProjectDashboard.css';

const WEEK_MS = 7 * 86400000;

// TaskStatus enum from the backend model: TODO | IN_PROGRESS | DONE.
const STATUS_COLUMNS = ['todo', 'in_progress', 'done'];
const STATUS_LABEL_KEY = {
  todo: 'projectDashboard.statusTodo',
  in_progress: 'projectDashboard.statusInProgress',
  done: 'projectDashboard.statusDone',
};
// TaskPriority enum: LOW | MEDIUM | HIGH.
const PRIORITY_LABEL_KEY = {
  low: 'projectDashboard.priorityLow',
  medium: 'projectDashboard.priorityMedium',
  high: 'projectDashboard.priorityHigh',
};

export default function ProjectDashboardPage({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { fullName } = useCurrentUser();
  const { projectId: routeProjectId } = useParams();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  const [myProjects, setMyProjects] = useState([]);
  const [projectId, setProjectId] = useState(routeProjectId || '');
  const [project, setProject] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [progress, setProgress] = useState(null);
  const [tasksError, setTasksError] = useState(false);

  const [meetings, setMeetings] = useState([]);
  const [applications, setApplications] = useState([]);

  const [incomingRequests, setIncomingRequests] = useState([]);
  const [actioningId, setActioningId] = useState(null);

  // Whether the signed-in user owns the selected project (vs. just being a
  // member on it) — decides which panels this dashboard shows, same split
  // MyProjectsPage already uses ("you own" vs. "you work on").
  // TEMP: forced to true so you can visually check the owner-view layout
  // without needing real login data. Revert to the real check below before
  // this goes anywhere near production:
  //   const isOwner = myProjects.find((p) => p.id === projectId)?.role === 'owner';
  const isOwner = true;

  // Load the user's projects once, to populate the project switcher. Defaults
  // the selection to the route param, or the first project, if none chosen yet.
  useEffect(() => {
    getMyProjects()
      .then((rows) => {
        setMyProjects(rows || []);
        if (!routeProjectId && rows?.length) {
          setProjectId(rows[0].id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL in sync when the user switches projects from the dropdown,
  // without forcing a full page reload.
  function handleProjectChange(id) {
    setProjectId(id);
    navigate(`/projects/${id}/dashboard`, { replace: true });
  }

  useEffect(() => {
    if (!projectId) return;
    getProject(projectId).then(setProject).catch(() => setProject(null));

    setTasksError(false);
    Promise.all([getProjectTasks(projectId), getProjectTaskProgress(projectId)])
      .then(([taskRows, prog]) => {
        setTasks(taskRows || []);
        setProgress(prog || null);
      })
      .catch(() => {
        // Tasks endpoint may not be live on the backend yet — degrade
        // gracefully instead of breaking the whole dashboard.
        setTasksError(true);
        setTasks([]);
        setProgress(null);
      });
  }, [projectId]);

  // Meetings and outgoing requests aren't project-scoped endpoints on the
  // backend today, so we fetch the user's full lists and filter client-side.
  useEffect(() => {
    listMeetings().then((rows) => setMeetings(rows || [])).catch(() => {});
    listMeetingRequests('outgoing').then((rows) => setApplications(rows || [])).catch(() => {});
  }, []);

  // Owner-only: requests other people have sent in to join this project.
  function loadIncomingRequests() {
    if (!projectId) return;
    listMeetingRequests('incoming', projectId)
      .then((rows) => setIncomingRequests(rows || []))
      .catch(() => setIncomingRequests([]));
  }
  useEffect(() => {
    if (isOwner) loadIncomingRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, projectId]);

  async function handleAccept(id) {
    setActioningId(id);
    try { await acceptMeetingRequest(id); loadIncomingRequests(); } catch { /* surfaced by refetch */ } finally { setActioningId(null); }
  }
  async function handleReject(id) {
    setActioningId(id);
    try { await rejectMeetingRequest(id); loadIncomingRequests(); } catch { /* ignore */ } finally { setActioningId(null); }
  }

  const requesterName = (r) =>
    r.requester ? (locale === 'ar' ? r.requester.name_ar : r.requester.name_en) : '—';

  const projectMeetings = useMemo(
    () => (projectId ? meetings.filter((m) => m.project_id === projectId) : meetings),
    [meetings, projectId],
  );
  const projectApplications = useMemo(
    () => (projectId ? applications.filter((a) => a.project_id === projectId) : applications),
    [applications, projectId],
  );

  const now = Date.now();
  const upcomingMeetings = projectMeetings
    .filter((m) => new Date(m.end_time).getTime() >= now)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const tasksByStatus = useMemo(() => {
    const map = { todo: [], in_progress: [], done: [] };
    tasks.forEach((task) => {
      const key = (task.status || 'todo').toLowerCase();
      if (map[key]) map[key].push(task);
    });
    return map;
  }, [tasks]);

  const overdueCount =
    progress?.overdue_count ??
    tasks.filter((task) => task.due_date && new Date(task.due_date).getTime() < now && task.status !== 'done').length;

  const completionPercent = progress?.percent_done ?? (
    tasks.length ? Math.round((tasksByStatus.done.length / tasks.length) * 100) : 0
  );

  const meetingsThisWeek = projectMeetings.filter(
    (m) => new Date(m.start_time).getTime() <= now + WEEK_MS && new Date(m.end_time).getTime() >= now,
  ).length;

  const pendingApplications = projectApplications.filter((a) => a.status === 'pending').length;
  const pendingIncoming = incomingRequests.filter((r) => r.status === 'pending').length;

  const stats = [
    {
      icon: CheckSquare,
      value: `${completionPercent}%`,
      label: t('projectDashboard.taskCompletion'),
      flag: t('projectDashboard.onTrack'),
      flagTone: 'ok',
    },
    {
      icon: Clock,
      value: overdueCount,
      label: t('projectDashboard.overdueTasks'),
      flag: t('projectDashboard.needsAttention'),
      flagTone: overdueCount > 0 ? 'bad' : 'ok',
    },
    {
      icon: Calendar,
      value: upcomingMeetings.length,
      label: t('projectDashboard.upcomingMeetings'),
      flag: t('projectDashboard.thisWeekCount', { count: meetingsThisWeek }),
      flagTone: 'ok',
    },
    isOwner ? {
      icon: Send,
      value: incomingRequests.length,
      label: t('projectDashboard.joinRequests'),
      flag: t('projectDashboard.pendingCount', { count: pendingIncoming }),
      flagTone: pendingIncoming > 0 ? 'warn' : 'ok',
    } : {
      icon: Send,
      value: projectApplications.length,
      label: t('projectDashboard.applicationsSent'),
      flag: t('projectDashboard.pendingCount', { count: pendingApplications }),
      flagTone: pendingApplications > 0 ? 'warn' : 'ok',
    },
  ];

  const dayNum = (iso) => new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(new Date(iso));
  const monthShort = (iso) => new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(iso));
  const daysAgo = (iso) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86400000));

  // Backend doesn't expose a project-members listing endpoint yet, so this
  // reads defensively off whatever the project payload includes and quietly
  // shows nothing if it isn't there — wire to a real endpoint once available.
  const team = project?.memberships || project?.members || [];

  return (
    <div className="pd bayn-scroll">
      <Sidebar activeKey="projects" onNavigate={onNavigate} />

      <div className="pd__main">
        <Navbar userName={fullName} />

        <main className="pd__body">
          <div className="pd__head">
            <div>
              <h1 className="pd__title">{t('projectDashboard.title')}</h1>
              <p className="pd__subtitle">{t('projectDashboard.subtitle')}</p>
            </div>

            {myProjects.length > 0 && (
              <label className="pd__select">
                <span className="pd__select-label">{t('projectDashboard.selectProject')}</span>
                <span className="pd__select-control">
                  <select value={projectId} onChange={(e) => handleProjectChange(e.target.value)}>
                    {myProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                  <ChevronDown width={16} height={16} aria-hidden="true" />
                </span>
              </label>
            )}
          </div>

          {/* Stat cards */}
          <div className="pd__stats">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="pd__stat-card">
                  <div className="pd__stat-top">
                    <span className="pd__stat-icon"><Icon width={18} height={18} aria-hidden="true" /></span>
                    <span className={`pd__stat-flag pd__stat-flag--${s.flagTone}`}>{s.flag}</span>
                  </div>
                  <span className="pd__stat-value">{s.value}</span>
                  <span className="pd__stat-label">{s.label}</span>
                </div>
              );
            })}
          </div>

          <div className="pd__split">
            {/* Tasks board */}
            <section className="pd__panel">
              <div className="pd__panel-head">
                <h3>{t('projectDashboard.tasks')}</h3>
                <button type="button" className="pd__panel-link">
                  <Plus width={16} height={16} aria-hidden="true" />
                  {t('projectDashboard.newTask')}
                </button>
              </div>

              {tasksError ? (
                <p className="pd__empty">{t('projectDashboard.tasksUnavailable')}</p>
              ) : (
                <div className="pd__board">
                  {STATUS_COLUMNS.map((status) => (
                    <div key={status} className="pd__col">
                      <div className="pd__col-head">
                        {t(STATUS_LABEL_KEY[status])}
                        <span className="pd__col-count">{tasksByStatus[status].length}</span>
                      </div>
                      {tasksByStatus[status].length === 0 ? (
                        <p className="pd__col-empty">{t('projectDashboard.noTasks')}</p>
                      ) : (
                        tasksByStatus[status].map((task) => {
                          const overdue =
                            task.due_date && new Date(task.due_date).getTime() < now && status !== 'done';
                          return (
                            <div key={task.id} className="pd__task-card">
                              <p className="pd__task-title">{task.title}</p>
                              <div className="pd__task-meta">
                                <span className={`pd__priority pd__priority--${(task.priority || 'low').toLowerCase()}`}>
                                  {t(PRIORITY_LABEL_KEY[(task.priority || 'low').toLowerCase()])}
                                </span>
                                {task.due_date && (
                                  <span className={`pd__due${overdue ? ' pd__due--overdue' : ''}`}>
                                    {overdue ? `${t('projectDashboard.overdue')} · ` : ''}
                                    {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(task.due_date))}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Owners see attendance across the team (owner-only per spec);
                members see the project roster instead. */}
            <aside className="pd__panel">
              {isOwner ? (
                <>
                  <div className="pd__panel-head"><h3>{t('projectDashboard.teamAttendance')}</h3></div>
                  {team.length === 0 ? (
                    <p className="pd__empty">{t('projectDashboard.attendanceUnavailable')}</p>
                  ) : (
                    <ul className="pd__team">
                      {team.map((member) => {
                        const name = locale === 'ar' ? member.name_ar : member.name_en;
                        const status = (member.attendance_status || '').toLowerCase();
                        return (
                          <li key={member.id} className="pd__team-row">
                            <p className="pd__team-name">{name || '—'}</p>
                            {status && (
                              <span className={`pd__attendance-badge pd__attendance-badge--${status}`}>
                                {t(`projectDashboard.attendance_${status}`, status)}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              ) : (
                <>
                  <div className="pd__panel-head"><h3>{t('projectDashboard.projectTeam')}</h3></div>
                  {team.length === 0 ? (
                    <p className="pd__empty">{t('projectDashboard.teamUnavailable')}</p>
                  ) : (
                    <ul className="pd__team">
                      {team.map((member) => {
                        const name = locale === 'ar' ? member.name_ar : member.name_en;
                        const isMe = member.is_current_user;
                        return (
                          <li key={member.id} className="pd__team-row">
                            <div>
                              <p className="pd__team-name">{name || '—'}</p>
                              <p className="pd__team-role">
                                {member.role === 'owner' ? t('projectDashboard.owner') : ''}
                                {member.role === 'owner' && member.job_title ? ' · ' : ''}
                                {member.job_title || ''}
                              </p>
                            </div>
                            {isMe && <span className="pd__team-you">{t('projectDashboard.you')}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </aside>
          </div>

          <div className="pd__row3">
            {/* Owners review incoming join requests here (with real
                accept/reject actions); members see their own sent applications. */}
            {isOwner ? (
              <section className="pd__panel">
                <div className="pd__panel-head">
                  <h3>{t('projectDashboard.joinRequests')}</h3>
                  <button type="button" className="pd__panel-link" onClick={() => navigate(`/join-requests/${projectId}`)}>
                    {t('projectDashboard.viewAll')}
                  </button>
                </div>
                {incomingRequests.filter((r) => r.status === 'pending').length === 0 ? (
                  <p className="pd__empty">{t('joinRequests.empty')}</p>
                ) : (
                  <ul className="pd__requests">
                    {incomingRequests.filter((r) => r.status === 'pending').slice(0, 3).map((r) => (
                      <li key={r.id} className="pd__request-row">
                        <div className="pd__request-top">
                          <span className="pd__request-avatar" aria-hidden="true">
                            {requesterName(r).trim().charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <p className="pd__request-name">{requesterName(r)}</p>
                            {r.requester?.job_title && <p className="pd__request-role">{r.requester.job_title}</p>}
                          </div>
                        </div>
                        {r.message && <p className="pd__request-msg">{r.message}</p>}
                        <div className="pd__request-actions">
                          <Button variant="primary" size="sm" onClick={() => handleAccept(r.id)} disabled={actioningId === r.id}>
                            {t('joinRequests.accept')}
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleReject(r.id)} disabled={actioningId === r.id}>
                            {t('joinRequests.reject')}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : (
              <section className="pd__panel">
                <div className="pd__panel-head">
                  <h3>{t('projectDashboard.applications')}</h3>
                  <button type="button" className="pd__panel-link">{t('projectDashboard.viewAll')}</button>
                </div>
                {projectApplications.length === 0 ? (
                  <p className="pd__empty">{t('projectDashboard.applicationsEmpty')}</p>
                ) : (
                  <ul className="pd__applications">
                    {projectApplications.slice(0, 4).map((a) => (
                      <li key={a.id} className="pd__application-row">
                        <div>
                          <p className="pd__application-title">{a.project?.title || t('projectDashboard.project')}</p>
                          <p className="pd__application-sub">
                            {a.job_title ? `${a.job_title} · ` : ''}
                            {t('projectDashboard.sentDaysAgo', { count: daysAgo(a.created_at) })}
                          </p>
                        </div>
                        <span className={`pd__status-pill pd__status-pill--${a.status}`}>
                          {t(`projectDashboard.status_${a.status}`, a.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {/* Upcoming meetings */}
            <section className="pd__panel">
              <div className="pd__panel-head">
                <h3>{t('projectDashboard.upcomingMeetingsTitle')}</h3>
                <button type="button" className="pd__panel-link" onClick={() => onNavigate?.('meetings')}>
                  {t('projectDashboard.viewAll')}
                </button>
              </div>
              {upcomingMeetings.length === 0 ? (
                <p className="pd__empty">{t('projectDashboard.meetingsEmpty')}</p>
              ) : (
                <ul className="pd__meetings">
                  {upcomingMeetings.slice(0, 4).map((m) => (
                    <li key={m.id} className="pd__meeting-row">
                      <span className="pd__meeting-date">
                        <span className="pd__meeting-day">{dayNum(m.start_time)}</span>
                        <span className="pd__meeting-month">{monthShort(m.start_time)}</span>
                      </span>
                      <div>
                        <p className="pd__meeting-title">{m.title || t('projectDashboard.meeting')}</p>
                        <p className="pd__meeting-sub">
                          {m.video_link ? t('projectDashboard.dailyRoom') : ''}
                        </p>
                        <span className="pd__meeting-badge">{t('projectDashboard.confirmed')}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Contracts (owner: every contract on this project) vs a single
                "my contract" summary (member). Backend has no "contracts by
                project" lookup yet, so this stays visually complete but empty
                until that endpoint exists. */}
            <section className="pd__panel">
              <div className="pd__panel-head">
                <h3>{t(isOwner ? 'projectDashboard.contracts' : 'projectDashboard.myContract')}</h3>
                <button type="button" className="pd__panel-link">{t('projectDashboard.viewAll')}</button>
              </div>
              <p className="pd__empty">{t('projectDashboard.contractUnavailable')}</p>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
