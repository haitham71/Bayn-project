import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import CheckSquare from '@/assets/icons/check-square.svg?react';
import Clock from '@/assets/icons/clock.svg?react';
import Calendar from '@/assets/icons/calendar.svg?react';
import Send from '@/assets/icons/send-horizontal.svg?react';
import Plus from '@/assets/icons/plus.svg?react';
import ArrowLeft from '@/assets/icons/arrow-left.svg?react';
import CalendarPicker from '@/shared/components/Calendar';
import Select from '@/shared/components/Select';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import { stageOf } from '@/features/meetings/lib/requestStatus';
import {
  getMyProjects,
  getProject,
  listProjectMembers,
} from '@/features/projects/services/projectService';
import {
  listMeetings,
  listMeetingRequests,
  createTeamMeeting,
  cancelTeamMeeting,
} from '@/features/meetings/services/meetingService';
import { useProjectTasks } from '../hooks/useProjectTasks';
import TaskBoard from '../components/TaskBoard';
import TaskSheet from '../components/TaskSheet';
import TeamChat from '../components/TeamChat';
import AssigneePicker from '../components/AssigneePicker';
import { toDateStr, parseDateStr } from '../lib/dates';
import './ProjectDashboard.css';

const WEEK_MS = 7 * 86400000;
const NOW = Date.now();

// Half-hour slots across the day, as "HH:MM" 24h values (labels get localized
// where they're rendered).
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});
const STEP_MIN = 30;
const MAX_MEETING_MIN = 120; // a meeting can run at most two hours
const LAST_SLOT_MIN = 23 * 60 + 30; // 23:30, the latest slot
const timeToMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export default function ProjectDashboardPage({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, fullName } = useCurrentUser();
  const { projectId: routeProjectId } = useParams();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  // Real project data — projects, team, tasks, meetings and requests load live.
  const [myProjects, setMyProjects] = useState([]);
  const [projectId, setProjectId] = useState(routeProjectId || '');
  const [project, setProject] = useState(null);
  const [team, setTeam] = useState([]);

  const { tasks, tasksError, reload: reloadTasks } = useProjectTasks(projectId);

  // Task side sheet — open for a new task (null) or an existing one.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTask, setSheetTask] = useState(null);

  const [meetings, setMeetings] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [cancelMeetingId, setCancelMeetingId] = useState(null);

  // "Schedule a team meeting" form: title/date/time + the members to invite.
  const [scheduleForm, setScheduleForm] = useState({
    title: '',
    date: '',
    from: '',
    to: '',
  });
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  // Whether the signed-in user owns the selected project (vs. just working on
  // it) — decides which panels this dashboard shows.
  const isOwner = myProjects.find((p) => p.id === projectId)?.role === 'owner';

  // Load my projects once, to resolve the selected project and my role in it.
  useEffect(() => {
    getMyProjects()
      .then((rows) => {
        setMyProjects(rows || []);
        if (!routeProjectId && rows?.length) setProjectId(rows[0].id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Project details + team roster for the selected project.
  useEffect(() => {
    if (!projectId) return;
    getProject(projectId)
      .then(setProject)
      .catch(() => setProject(null));
    listProjectMembers(projectId)
      .then((rows) => setTeam(rows || []))
      .catch(() => setTeam([]));
  }, [projectId]);

  // My confirmed meetings (not project-scoped on the backend, so fetch the full
  // list and filter client-side).
  useEffect(() => {
    listMeetings()
      .then((rows) => setMeetings(rows || []))
      .catch(() => {});
  }, []);

  // Owner-only: join requests other people have sent in for this project.
  useEffect(() => {
    if (!projectId || !isOwner) {
      setIncomingRequests([]);
      return;
    }
    listMeetingRequests('incoming', projectId)
      .then((rows) => setIncomingRequests(rows || []))
      .catch(() => setIncomingRequests([]));
  }, [projectId, isOwner]);

  const formatDateStr = (s) =>
    new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(parseDateStr(s));

  // Half-hour slots with localized, readable labels (e.g. "9:00 AM").
  const timeOptions = useMemo(
    () =>
      TIME_SLOTS.map((v) => {
        const [h, m] = v.split(':').map(Number);
        return {
          value: v,
          label: new Intl.DateTimeFormat(locale, {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }).format(new Date(2000, 0, 1, h, m)),
        };
      }),
    [locale],
  );

  // When the meeting is today, hide times that have already passed (future
  // dates keep the full day). -1 means "no cutoff".
  const cutoffFor = (dateStr) => {
    if (!dateStr) return -1;
    const d = parseDateStr(dateStr);
    const today = new Date(NOW);
    const sameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    return sameDay ? today.getHours() * 60 + today.getMinutes() : -1;
  };
  const nowCutoffMin = cutoffFor(scheduleForm.date);

  // Start times: still to come today, and with room for at least one end.
  const fromOptions = useMemo(
    () =>
      timeOptions.filter(
        (o) =>
          timeToMin(o.value) > nowCutoffMin &&
          timeToMin(o.value) + STEP_MIN <= LAST_SLOT_MIN,
      ),
    [timeOptions, nowCutoffMin],
  );
  // End times are strictly after the chosen start and at most two hours later.
  const toOptions = useMemo(() => {
    if (!scheduleForm.from) return [];
    const base = timeToMin(scheduleForm.from);
    return timeOptions.filter((o) => {
      const m = timeToMin(o.value);
      return m > base && m <= base + MAX_MEETING_MIN;
    });
  }, [timeOptions, scheduleForm.from]);

  // Picking a start clears an end that no longer fits (before it, or > 2h away).
  function setFrom(v) {
    setScheduleForm((f) => {
      const end = timeToMin(f.to);
      const start = timeToMin(v);
      const keep = f.to && end > start && end <= start + MAX_MEETING_MIN;
      return { ...f, from: v, to: keep ? f.to : '' };
    });
  }

  // Picking a day drops any start/end that would now sit in the past for it.
  function setDate(d) {
    const date = toDateStr(d);
    const cutoff = cutoffFor(date);
    setScheduleForm((f) => {
      const from = f.from && timeToMin(f.from) > cutoff ? f.from : '';
      const start = timeToMin(from);
      const to =
        from &&
        f.to &&
        timeToMin(f.to) > start &&
        timeToMin(f.to) <= start + MAX_MEETING_MIN
          ? f.to
          : '';
      return { ...f, date, from, to };
    });
  }

  const scheduleReady =
    scheduleForm.title.trim() &&
    scheduleForm.date &&
    scheduleForm.from &&
    scheduleForm.to &&
    scheduleForm.from < scheduleForm.to;

  async function handleSchedule(e) {
    e.preventDefault();
    if (!scheduleReady || scheduling) return;
    setScheduling(true);
    setScheduleError('');
    try {
      const start = new Date(
        `${scheduleForm.date}T${scheduleForm.from}`,
      ).toISOString();
      const end = new Date(
        `${scheduleForm.date}T${scheduleForm.to}`,
      ).toISOString();
      await createTeamMeeting({
        project_id: projectId,
        title: scheduleForm.title.trim(),
        start_time: start,
        end_time: end,
        participant_ids: selectedMembers,
      });
      const rows = await listMeetings();
      setMeetings(rows || []);
      setScheduleForm({ title: '', date: '', from: '', to: '' });
      setSelectedMembers([]);
    } catch {
      setScheduleError(t('projectDashboard.scheduleFailed'));
    } finally {
      setScheduling(false);
    }
  }

  const memberById = (id) => team.find((m) => m.user_id === id) || null;

  const openNewTask = () => {
    setSheetTask(null);
    setSheetOpen(true);
  };
  const openTaskDetails = (task) => {
    setSheetTask(task);
    setSheetOpen(true);
  };

  const requesterName = (r) =>
    r.requester
      ? locale === 'ar'
        ? r.requester.name_ar
        : r.requester.name_en
      : '—';

  const projectMeetings = useMemo(
    () =>
      projectId ? meetings.filter((m) => m.project_id === projectId) : meetings,
    [meetings, projectId],
  );

  const now = Date.now();
  const upcomingMeetings = projectMeetings
    .filter((m) => new Date(m.end_time).getTime() >= now)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const doneCount = tasks.filter(
    (task) => (task.status || 'todo').toLowerCase() === 'done',
  ).length;
  const overdueCount = tasks.filter(
    (task) =>
      task.due_date &&
      new Date(task.due_date).getTime() < now &&
      (task.status || '').toLowerCase() !== 'done',
  ).length;
  const completionPercent = tasks.length
    ? Math.round((doneCount / tasks.length) * 100)
    : 0;

  const meetingsThisWeek = projectMeetings.filter(
    (m) =>
      new Date(m.start_time).getTime() <= now + WEEK_MS &&
      new Date(m.end_time).getTime() >= now,
  ).length;

  const pendingIncoming = incomingRequests.filter(
    (r) => r.status === 'pending',
  ).length;

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
    // Join requests are an owner-only concern — members don't see this card.
    ...(isOwner
      ? [
          {
            icon: Send,
            value: incomingRequests.length,
            label: t('projectDashboard.joinRequests'),
            flag: t('projectDashboard.pendingCount', {
              count: pendingIncoming,
            }),
            flagTone: pendingIncoming > 0 ? 'warn' : 'ok',
          },
        ]
      : []),
  ];

  const dayNum = (iso) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(new Date(iso));
  const monthShort = (iso) =>
    new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(iso));

  const selectedProject =
    project || myProjects.find((p) => p.id === projectId) || null;

  // Panels reused across the owner/member layouts (composed differently below).
  // Owner cancels a team meeting (user_id === counterpart_id marks a team room).
  async function confirmCancelMeeting() {
    const id = cancelMeetingId;
    setCancelMeetingId(null);
    setMeetings((ms) => ms.filter((m) => m.id !== id));
    try {
      await cancelTeamMeeting(id);
    } catch {
      /* leave it removed; a reload would restore it on failure */
    }
  }

  const upcomingMeetingsPanel = (
    <section className="pd__panel">
      <div className="pd__panel-head">
        <h3>{t('projectDashboard.upcomingMeetingsTitle')}</h3>
        <button
          type="button"
          className="pd__panel-link"
          onClick={() => onNavigate?.('meetings')}
        >
          {t('projectDashboard.viewAll')}
        </button>
      </div>
      {upcomingMeetings.length === 0 ? (
        <p className="pd__empty">{t('projectDashboard.meetingsEmpty')}</p>
      ) : (
        <ul className="pd__meetings pd__meetings--scroll bayn-scroll">
          {upcomingMeetings.map((m) => (
            <li key={m.id} className="pd__meeting-row">
              <span className="pd__meeting-date">
                <span className="pd__meeting-day">{dayNum(m.start_time)}</span>
                <span className="pd__meeting-month">{monthShort(m.start_time)}</span>
              </span>
              <div>
                <p className="pd__meeting-title">
                  {m.title || t('projectDashboard.meeting')}
                </p>
                <span className="pd__meeting-badge">
                  {t('projectDashboard.confirmed')}
                </span>
              </div>
              {m.user_id === m.counterpart_id && m.user_id === user?.id && (
                <button
                  type="button"
                  className="pd__meeting-cancel"
                  onClick={() => setCancelMeetingId(m.id)}
                >
                  {t('projectDashboard.cancelMeeting')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const contractPanel = (
    <section className="pd__panel">
      <div className="pd__panel-head">
        <h3>{t(isOwner ? 'projectDashboard.contracts' : 'projectDashboard.myContract')}</h3>
        <button type="button" className="pd__panel-link">
          {t('projectDashboard.viewAll')}
        </button>
      </div>
      <p className="pd__empty">{t('projectDashboard.contractUnavailable')}</p>
    </section>
  );

  const joinRequestsPanel = (
    <section className="pd__panel">
      <div className="pd__panel-head">
        <h3>{t('projectDashboard.joinRequests')}</h3>
        <button
          type="button"
          className="pd__panel-link"
          onClick={() => navigate(`/join-requests/${projectId}`)}
        >
          {t('projectDashboard.viewAll')}
        </button>
      </div>
      {incomingRequests.length === 0 ? (
        <p className="pd__empty">{t('joinRequests.empty')}</p>
      ) : (
        <ul className="pd__requests">
          {incomingRequests.slice(0, 4).map((r) => {
            const stage = stageOf(r);
            return (
              <li key={r.id} className="pd__request-row">
                <div className="pd__request-top">
                  <span className="pd__request-avatar" aria-hidden="true">
                    {requesterName(r).trim().charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="pd__request-name">{requesterName(r)}</p>
                    {r.requester?.job_title && (
                      <p className="pd__request-role">{r.requester.job_title}</p>
                    )}
                  </div>
                  <span className={`pd__req-stage pd__req-stage--${stage}`}>
                    {t(`joinRequests.tab.${stage}`)}
                  </span>
                </div>
                {r.message && <p className="pd__request-msg">{r.message}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  const projectTeamPanel = (
    <aside className="pd__panel">
      <div className="pd__panel-head">
        <h3>{t('projectDashboard.projectTeam')}</h3>
      </div>
      {team.length === 0 ? (
        <p className="pd__empty">{t('projectDashboard.teamUnavailable')}</p>
      ) : (
        <ul className="pd__team">
          {team.map((member) => {
            const name = locale === 'ar' ? member.name_ar : member.name_en;
            const specialization =
              locale === 'ar' ? member.specialization_ar : member.specialization_en;
            const isMe = member.user_id === user?.id;
            return (
              <li key={member.user_id} className="pd__team-row">
                <div>
                  <p className="pd__team-name">
                    {name || '—'}
                    {member.username && (
                      <span className="pd__team-username"> · <bdi>@{member.username}</bdi></span>
                    )}
                  </p>
                  <p className="pd__team-role">
                    {member.role === 'owner' ? t('projectDashboard.owner') : ''}
                    {member.role === 'owner' && specialization ? ' · ' : ''}
                    {specialization || ''}
                  </p>
                </div>
                {isMe && <span className="pd__team-you">{t('projectDashboard.you')}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );

  return (
    <div className="pd bayn-scroll">
      <Sidebar activeKey="projects" onNavigate={onNavigate} />

      <div className="pd__main">
        <Navbar userName={fullName} />

        <button type="button" className="pd__back" onClick={() => onNavigate?.('myprojects')}>
          <ArrowLeft width={22} height={22} aria-hidden="true" />
          {t('myProjects.backToProjects')}
        </button>

        <main className="pd__body">
          <div className="pd__head">
            <div>
              <h1 className="pd__title">{t('projectDashboard.title')}</h1>
              <p className="pd__subtitle">{t('projectDashboard.subtitle')}</p>
            </div>

            {selectedProject && (
              <div className="pd__project">
                <span className="pd__project-name">
                  {selectedProject.title}
                </span>
              </div>
            )}
          </div>

          {/* Stat cards */}
          <div className="pd__stats">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="pd__stat-card">
                  <div className="pd__stat-top">
                    <span className="pd__stat-icon">
                      <Icon width={18} height={18} aria-hidden="true" />
                    </span>
                    <span
                      className={`pd__stat-flag pd__stat-flag--${s.flagTone}`}
                    >
                      {s.flag}
                    </span>
                  </div>
                  <span className="pd__stat-value">{s.value}</span>
                  <span className="pd__stat-label">{s.label}</span>
                </div>
              );
            })}
          </div>

          <div className="pd__lower">
            {/* Owner-only: schedule a new team meeting (narrow side card). */}
            {isOwner && (
              <section className="pd__panel pd__schedule">
                <div className="pd__panel-head">
                  <h3>{t('projectDashboard.scheduleTitle')}</h3>
                </div>
                <form className="pd__schedule-form" onSubmit={handleSchedule}>
                  <label className="pd__field pd__field--grow">
                    <span className="pd__field-label">
                      {t('projectDashboard.scheduleName')}
                    </span>
                    <input
                      type="text"
                      value={scheduleForm.title}
                      onChange={(e) =>
                        setScheduleForm((f) => ({
                          ...f,
                          title: e.target.value,
                        }))
                      }
                      placeholder={t('projectDashboard.scheduleNamePh')}
                    />
                  </label>
                  <div className="pd__field">
                    <span className="pd__field-label">
                      {t('projectDashboard.scheduleDate')}
                    </span>
                    <div className="pd__calendar-inline">
                      <CalendarPicker
                        initialDate={
                          scheduleForm.date
                            ? parseDateStr(scheduleForm.date)
                            : new Date()
                        }
                        selectedDates={
                          scheduleForm.date
                            ? [parseDateStr(scheduleForm.date)]
                            : []
                        }
                        onSelectDate={setDate}
                      />
                    </div>
                    {scheduleForm.date && (
                      <p className="pd__field-note">
                        {formatDateStr(scheduleForm.date)}
                      </p>
                    )}
                  </div>
                  <div className="pd__field">
                    <span className="pd__field-label">
                      {t('projectDashboard.scheduleTime')}
                    </span>
                    <div className="pd__time-row">
                      <Select
                        label={t('projectDashboard.scheduleFrom')}
                        value={scheduleForm.from}
                        onChange={setFrom}
                        options={fromOptions}
                        className="pd__time-select"
                      />
                      <Select
                        label={t('projectDashboard.scheduleTo')}
                        value={scheduleForm.to}
                        onChange={(v) =>
                          setScheduleForm((f) => ({ ...f, to: v }))
                        }
                        options={toOptions}
                        disabled={!scheduleForm.from}
                        className="pd__time-select"
                      />
                    </div>
                  </div>
                  <div className="pd__field">
                    <span className="pd__field-label">
                      {t('projectDashboard.scheduleParticipants')}
                    </span>
                    {team.filter((m) => m.user_id !== user?.id).length === 0 ? (
                      <p className="pd__field-note pd__field-note--muted">
                        {t('projectDashboard.scheduleNoMembers')}
                      </p>
                    ) : (
                      <AssigneePicker
                        team={team.filter((m) => m.user_id !== user?.id)}
                        value={selectedMembers}
                        onChange={setSelectedMembers}
                        locale={locale}
                        placeholder={t('projectDashboard.scheduleSelectMembers')}
                      />
                    )}
                  </div>

                  {scheduleError && (
                    <p className="pd__schedule-error">{scheduleError}</p>
                  )}

                  <button
                    type="submit"
                    className="pd__schedule-btn"
                    disabled={!scheduleReady || scheduling}
                  >
                    <Plus width={16} height={16} aria-hidden="true" />
                    {scheduling
                      ? t('projectDashboard.scheduling')
                      : t('projectDashboard.scheduleBtn')}
                  </button>
                </form>
              </section>
            )}

            <div className={`pd__mid pd__mid--${isOwner ? 'owner' : 'member'}`}>
              {isOwner ? (
                <>
                  {joinRequestsPanel}
                  {upcomingMeetingsPanel}
                  {contractPanel}
                  {projectTeamPanel}
                </>
              ) : (
                <>
                  {upcomingMeetingsPanel}
                  <div className="pd__mid-row">
                    {contractPanel}
                    {projectTeamPanel}
                  </div>
                </>
              )}
            </div>

            {selectedProject && (
              <TeamChat
                project={selectedProject}
                team={team}
                currentUserId={user?.id}
                locale={locale}
              />
            )}
          </div>

          {/* The task board spans the full width at the bottom. */}
          <TaskBoard
            tasks={tasks}
            tasksError={tasksError}
            isOwner={isOwner}
            memberById={memberById}
            locale={locale}
            onNewTask={openNewTask}
            onOpenTask={openTaskDetails}
          />
        </main>
      </div>

      <TaskSheet
        open={sheetOpen}
        task={sheetTask}
        projectId={projectId}
        team={team}
        isOwner={isOwner}
        currentUserId={user?.id}
        locale={locale}
        onClose={() => setSheetOpen(false)}
        onSaved={() => {
          reloadTasks();
          setSheetOpen(false);
        }}
      />

      <ConfirmDialog
        open={cancelMeetingId != null}
        title={t('projectDashboard.cancelMeetingTitle')}
        message={t('projectDashboard.cancelMeetingMsg')}
        confirmLabel={t('projectDashboard.cancelMeetingConfirm')}
        cancelLabel={t('projectDashboard.cancelMeetingKeep')}
        onConfirm={confirmCancelMeeting}
        onCancel={() => setCancelMeetingId(null)}
      />
    </div>
  );
}
