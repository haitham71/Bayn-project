import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import UpcomingMeetings from '@/features/meetings/components/UpcomingMeetings';
import Plus from '@/assets/icons/plus.svg?react';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useMyProjectsData } from '../hooks/useMyProjectsData';
import OwnedProjectCard from '../components/OwnedProjectCard';
import WorkingProjectCard from '../components/WorkingProjectCard';
import AssignedTasksBox from '../components/AssignedTasksBox';
import './MyProjectsPage.css';

export default function MyProjectsPage({ onNavigate }) {
  const { t } = useTranslation();
  const { user, fullName } = useCurrentUser();
  const { meetings, owned, working, myTasks, atLimit } = useMyProjectsData(user?.id);

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
                  <OwnedProjectCard key={p.id} project={p} />
                ))}

                {/* Once every project slot is taken there's nothing to add, so
                    the tile goes away rather than sitting there disabled. */}
                {!atLimit && (
                  <button
                    type="button"
                    className="mp__add"
                    onClick={() => onNavigate?.('createidea')}
                  >
                    <Plus width={56} height={56} aria-hidden="true" />
                    <span className="mp__add-label">{t('myProjects.postNew')}</span>
                  </button>
                )}
              </div>
            </section>

            {/* Projects you work on */}
            <section className="mp__section">
              <h1 className="mp__title">{t('myProjects.youWorkOn')}</h1>
              <div className="mp__cards">
                {working.map((p) => (
                  <WorkingProjectCard key={p.id} project={p} />
                ))}
              </div>
            </section>
          </div>

          {/* Tasks + upcoming meetings */}
          <aside className="mp__side">
            <AssignedTasksBox tasks={myTasks} />

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
