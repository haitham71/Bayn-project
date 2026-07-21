import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Headset from '@/assets/icons/headset.svg?react';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useHomeData } from '../hooks/useHomeData';
import { MAX_PROJECTS, greetingKey } from '../lib/constants';
import TeamCard from '../components/TeamCard';
import MyTasksCard from '../components/MyTasksCard';
import ApplicationsCard from '../components/ApplicationsCard';
import RecommendedIdeas from '../components/RecommendedIdeas';
import ScheduleAside from '../components/ScheduleAside';
import './Homepage.css';

export default function HomePage({ onNavigate }) {
  const { t } = useTranslation();
  const { user, firstName, fullName } = useCurrentUser();

  const { meetings, recIdeas, myProjects, myTasks } = useHomeData(user?.id);
  const ownedProjects = myProjects.filter((p) => p.role === 'owner');
  // myProjects holds every membership, so its length is what counts toward the cap.
  const atProjectLimit = myProjects.length >= MAX_PROJECTS;

  const greeting = t(`home.${greetingKey()}`);

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
                <TeamCard projects={myProjects} />
                <MyTasksCard tasks={myTasks} />
                <ApplicationsCard projects={ownedProjects} />
              </div>

              <RecommendedIdeas ideas={recIdeas} />
            </section>

            <ScheduleAside meetings={meetings} />
          </div>
        </main>
      </div>

      <button type="button" className="home__support" aria-label={t('home.support')}>
        <Headset width={24} height={24} aria-hidden="true" />
      </button>
    </div>
  );
}
