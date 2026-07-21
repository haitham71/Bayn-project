import { useTranslation } from 'react-i18next';
import { PRIORITY_KEY } from '../lib/constants';
import './MyTasksCard.css';

// "Current tasks" card — tasks assigned to me and not yet done, capped to a few
// rows with the rest behind a scroller.
export default function MyTasksCard({ tasks }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  return (
    <article className="home__card">
      <h2 className="home__card-title">{t('home.currentTasksLabel')}</h2>
      <div className="home__card-body">
        {tasks.length === 0 ? (
          <p className="home__team-empty">{t('home.tasksEmpty')}</p>
        ) : (
          <ul className="home__tasks bayn-scroll">
            {tasks.map((task) => {
              const status = (task.status || 'todo').toLowerCase();
              const priority = (task.priority || 'low').toLowerCase();
              return (
                <li key={task.id} className="home__task">
                  <span className={`home__task-dot home__task-dot--${status}`} aria-hidden="true" />
                  <span className="home__task-info">
                    <span className="home__task-title">{task.title}</span>
                    <span className="home__task-project">{task.projectTitle}</span>
                  </span>
                  <span className="home__task-side">
                    <span className={`home__task-priority home__task-priority--${priority}`}>
                      {t(PRIORITY_KEY[priority])}
                    </span>
                    {task.due_date && (
                      <span className="home__task-due">
                        {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(task.due_date))}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </article>
  );
}
