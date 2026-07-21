import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Headset from '@/assets/icons/headset.svg?react';
import Mail from '@/assets/icons/mail.svg?react';
import Phone from '@/assets/icons/phone.svg?react';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useHomeData } from '../hooks/useHomeData';
import { MAX_PROJECTS, SUPPORT_EMAIL, SUPPORT_PHONE, greetingKey } from '../lib/constants';
import TeamCard from '../components/TeamCard';
import MyTasksCard from '../components/MyTasksCard';
import ApplicationsCard from '../components/ApplicationsCard';
import RecommendedIdeas from '../components/RecommendedIdeas';
import ScheduleAside from '../components/ScheduleAside';
import './Homepage.css';

export default function HomePage({ onNavigate }) {
  const { t } = useTranslation();
  const { user, firstName, fullName } = useCurrentUser();

  // Floating support popover — closes on outside click or Escape.
  const [supportOpen, setSupportOpen] = useState(false);
  const supportRef = useRef(null);
  useEffect(() => {
    if (!supportOpen) return undefined;
    function onDown(e) {
      if (supportRef.current && !supportRef.current.contains(e.target)) setSupportOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setSupportOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [supportOpen]);

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

      <div className="home__support-wrap" ref={supportRef}>
        {supportOpen && (
          <div className="home__support-card" role="dialog" aria-label={t('home.supportTitle')}>
            <p className="home__support-title">{t('home.supportTitle')}</p>
            <p className="home__support-hint">{t('home.supportHint')}</p>
            <a className="home__support-row" href={`mailto:${SUPPORT_EMAIL}`}>
              <span className="home__support-ico">
                <Mail width={18} height={18} aria-hidden="true" />
              </span>
              <span className="home__support-val" dir="ltr">{SUPPORT_EMAIL}</span>
            </a>
            <a className="home__support-row" href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}>
              <span className="home__support-ico">
                <Phone width={18} height={18} aria-hidden="true" />
              </span>
              <span className="home__support-val" dir="ltr">{SUPPORT_PHONE}</span>
            </a>
          </div>
        )}
        <button
          type="button"
          className="home__support"
          aria-label={t('home.support')}
          aria-expanded={supportOpen}
          onClick={() => setSupportOpen((v) => !v)}
        >
          <Headset width={24} height={24} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
