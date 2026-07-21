import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getMyProjects, listProjectTasks } from '@/features/projects/services/projectService';
import { listMeetings } from '@/features/meetings/services/meetingService';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import UpcomingMeetings from '@/features/meetings/components/UpcomingMeetings';
import Flag from '@/assets/icons/flag.svg?react';
import UserCheck from '@/assets/icons/user-check.svg?react';
import List from '@/assets/icons/list.svg?react';
import LayoutDashboard from '@/assets/icons/layout-dashboard.svg?react';
import Plus from '@/assets/icons/plus.svg?react';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import './MyProjectsPage.css';

// A user can belong to at most this many projects (owner + member) — mirrors
// the backend's MAX_MEMBERSHIPS_PER_USER.
const MAX_PROJECTS = 2;

// Maps a backend ProjectStage to its translated label (reuses the create-idea keys).
const STAGE_LABEL = {
  planning: 'createIdea.stagePlanning',
  development: 'createIdea.stageDevelopment',
  launching: 'createIdea.stageLaunching',
};

function daysSince(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export default function MyProjectsPage({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, fullName } = useCurrentUser();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  const [meetings, setMeetings] = useState([]);
  useEffect(() => {
    listMeetings().then((rows) => setMeetings(rows || [])).catch(() => {});
  }, []);

  // My projects, split by role: owned vs worked-on.
  const [owned, setOwned] = useState([]);
  const [working, setWorking] = useState([]);
  // working holds every membership, so its length is the total that counts toward the cap.
  const atLimit = working.length >= MAX_PROJECTS;

  useEffect(() => {
    getMyProjects()
      .then((rows) => {
        // "You own" = projects you lead; "you work on" = every project you're
        // part of, including the ones you own.
        setOwned(rows.filter((p) => p.role === 'owner'));
        setWorking(rows);
      })
      .catch(() => {});
  }, []);

  // Tasks assigned to me across all my projects (there's no cross-project task
  // endpoint, so gather each project's tasks and keep only my own).
  const [myTasks, setMyTasks] = useState([]);
  useEffect(() => {
    if (!working.length || !user?.id) { setMyTasks([]); return; }
    Promise.all(
      working.map((p) =>
        listProjectTasks(p.id)
          .then((rows) => (rows || []).map((task) => ({ ...task, projectTitle: p.title })))
          .catch(() => []),
      ),
    ).then((lists) => {
      setMyTasks(
        lists
          .flat()
          .filter((task) => task.assigned_to === user.id && (task.status || 'todo').toLowerCase() !== 'done'),
      );
    });
  }, [working, user?.id]);

  return (
    <div className="mp">
      <Sidebar activeKey="projects" onNavigate={onNavigate} />

      <div className="mp__main">
        <Navbar userName={fullName} />

        <main className="mp__body">
          <div className="mp__content">
            {/* Projects you own */}
            <section className="mp__section">
              <h1 className="mp__title">{t('myProjects.youOwn')}</h1>
              <div className="mp__cards">
                {owned.map((p) => (
                  <article key={p.id} className="mp__project">
                    <span className="mp__project-label">{t('myProjects.projectLabel')}</span>
                    <h2 className="mp__project-title">{p.title}</h2>
                    <div className="mp__pills">
                      <span className="mp__pill">
                        <Flag width={14} height={14} aria-hidden="true" />
                        {t(STAGE_LABEL[p.stage] || STAGE_LABEL.planning)}
                      </span>
                      <span className="mp__pill">
                        <UserCheck width={16} height={16} aria-hidden="true" />
                        {t('myProjects.opening', { count: p.team_members_needed })}
                      </span>
                    </div>
                    <div className="mp__project-foot">
                      <span className="mp__posted">
                        {t('myProjects.postedDaysAgo', { count: daysSince(p.created_at) })}
                      </span>
                      <div className="mp__project-actions">
                        <button type="button" className="mp__link" onClick={() => navigate(`/edit-idea/${p.id}`)}>
                          {t('myProjects.viewDetails')}
                          <List width={20} height={20} aria-hidden="true" />
                        </button>
                        <button type="button" className="mp__link" onClick={() => navigate(`/join-requests/${p.id}`)}>
                          {t('myProjects.joinRequests')}
                          <UserCheck width={18} height={18} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}

                <button
                  type="button"
                  className="mp__add"
                  onClick={() => onNavigate?.('createidea')}
                  disabled={atLimit}
                  title={atLimit ? t('myProjects.limitReached') : undefined}
                >
                  <Plus width={56} height={56} aria-hidden="true" />
                  <span className="mp__add-label">
                    {atLimit ? t('myProjects.limitReached') : t('myProjects.postNew')}
                  </span>
                </button>
              </div>
            </section>

            {/* Projects you work on */}
            <section className="mp__section">
              <h1 className="mp__title">{t('myProjects.youWorkOn')}</h1>
              <div className="mp__cards">
                {working.map((p) => (
                  <article key={p.id} className="mp__project">
                    <span className="mp__project-label">{t('myProjects.projectLabel')}</span>
                    <h2 className="mp__project-title">{p.title}</h2>
                    <div className="mp__project-foot">
                      <span className="mp__pill">
                        <Flag width={14} height={14} aria-hidden="true" />
                        {t(STAGE_LABEL[p.stage] || STAGE_LABEL.planning)}
                      </span>
                      <button type="button" className="mp__link" onClick={() => navigate(`/projects/${p.id}/dashboard`)}>
                        {t('myProjects.dashboard')}
                        <LayoutDashboard width={20} height={20} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          {/* Tasks + upcoming meetings */}
          <aside className="mp__side">
            <section className="mp__box">
              <h2 className="mp__box-title">{t('myProjects.tasksTitle')}</h2>
              {myTasks.length === 0 ? (
                <p className="mp__box-empty">{t('myProjects.tasksEmpty')}</p>
              ) : (
                <ul className="mp__tasks bayn-scroll">
                  {myTasks.map((task) => {
                    const status = (task.status || 'todo').toLowerCase();
                    return (
                      <li key={task.id} className="mp__task">
                        <span className={`mp__task-dot mp__task-dot--${status}`} aria-hidden="true" />
                        <div className="mp__task-info">
                          <p className="mp__task-title">{task.title}</p>
                          <p className="mp__task-project">{task.projectTitle}</p>
                        </div>
                        {task.due_date && (
                          <span className="mp__task-due">
                            {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(task.due_date))}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="mp__box">
              <h2 className="mp__box-title">{t('myProjects.upcomingMeetings')}</h2>
              <UpcomingMeetings meetings={meetings} />
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}
