import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Radio from '@/shared/components/Radio';
import Calendar from '@/shared/components/Calendar';
import Flag from '@/assets/icons/flag.svg?react';
import UserCheck from '@/assets/icons/user-check.svg?react';
import List from '@/assets/icons/list.svg?react';
import LayoutDashboard from '@/assets/icons/layout-dashboard.svg?react';
import Plus from '@/assets/icons/plus.svg?react';
import './MyProjectsPage.css';

const SIDEBAR_ROUTES = { home: 'home', projects: 'myprojects', profile: 'myprofile' };

// Mock data — replaced by the projects API later.
const OWNED = [
  { id: 1, title: 'AI-Powered Personal Finance Assistant', openings: 4, postedDays: 3 },
];
const WORKING = [
  { id: 2, title: 'AI-Powered Personal Finance Assistant' },
];
const MEETINGS = [
  { id: 'm1', project: 'AI-Powered Personal Finance Assistant', noteKey: 'meetingJoinRequest', date: new Date(2025, 8, 9), when: '9 Sep 2025 | 9:00am - 10:00am' },
  { id: 'm2', project: 'AI-Powered Personal Finance Assistant', noteKey: 'meetingWeeklyTeam', date: new Date(2025, 8, 11), when: '11 Sep 2025 | 11:00am - 01:00pm' },
  { id: 'm3', project: 'AI-Powered Personal Finance Assistant', noteKey: 'meetingJoinRequest', date: new Date(2025, 8, 13), when: '13 Sep 2025 | 04:00am - 05:00pm' },
];

export default function MyProjectsPage({ onNavigate }) {
  const { t } = useTranslation();
  const [activeMeeting, setActiveMeeting] = useState('m1');

  return (
    <div className="mp">
      <Sidebar
        activeKey="projects"
        onNavigate={(key) => SIDEBAR_ROUTES[key] && onNavigate?.(SIDEBAR_ROUTES[key])}
      />

      <div className="mp__main">
        <Navbar userName="Assad Al-saeed" />

        <main className="mp__body">
          <div className="mp__content">
            {/* Projects you own */}
            <section className="mp__section">
              <h1 className="mp__title">{t('myProjects.youOwn')}</h1>
              <div className="mp__cards">
                {OWNED.map((p) => (
                  <article key={p.id} className="mp__project">
                    <span className="mp__project-label">{t('myProjects.projectLabel')}</span>
                    <h2 className="mp__project-title">{p.title}</h2>
                    <div className="mp__pills">
                      <span className="mp__pill">
                        <Flag width={14} height={14} aria-hidden="true" />
                        {t('myProjects.planningStage')}
                      </span>
                      <span className="mp__pill">
                        <UserCheck width={16} height={16} aria-hidden="true" />
                        {t('myProjects.opening', { count: p.openings })}
                      </span>
                    </div>
                    <div className="mp__project-foot">
                      <span className="mp__posted">
                        {t('myProjects.postedDaysAgo', { count: p.postedDays })}
                      </span>
                      <button type="button" className="mp__link">
                        {t('myProjects.viewDetails')}
                        <List width={20} height={20} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ))}

                <button type="button" className="mp__add">
                  <Plus width={56} height={56} aria-hidden="true" />
                  <span className="mp__add-label">{t('myProjects.postNew')}</span>
                </button>
              </div>
            </section>

            {/* Projects you work on */}
            <section className="mp__section">
              <h1 className="mp__title">{t('myProjects.youWorkOn')}</h1>
              <div className="mp__cards">
                {WORKING.map((p) => (
                  <article key={p.id} className="mp__project">
                    <span className="mp__project-label">{t('myProjects.projectLabel')}</span>
                    <h2 className="mp__project-title">{p.title}</h2>
                    <div className="mp__project-foot">
                      <span className="mp__pill">
                        <Flag width={14} height={14} aria-hidden="true" />
                        {t('myProjects.planningStage')}
                      </span>
                      <button type="button" className="mp__link">
                        {t('myProjects.dashboard')}
                        <LayoutDashboard width={20} height={20} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          {/* Calendar + upcoming meetings */}
          <aside className="mp__side">
            <Calendar
              title={t('myProjects.calendarTitle')}
              markedDates={MEETINGS.map((m) => m.date)}
            />

            <ul className="mp__meetings">
              {MEETINGS.map((m) => (
                <li key={m.id}>
                  <label className="mp__meeting">
                    <Radio
                      name="mp-meeting"
                      value={m.id}
                      checked={activeMeeting === m.id}
                      onChange={() => setActiveMeeting(m.id)}
                    />
                    <span className="mp__meeting-body">
                      <span className="mp__meeting-project">{m.project}</span>
                      <span className="mp__meeting-note">
                        {t(`myProjects.${m.noteKey}`)} {m.when}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </aside>
        </main>
      </div>
    </div>
  );
}
