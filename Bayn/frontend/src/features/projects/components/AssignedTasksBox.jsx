import { useTranslation } from 'react-i18next';
import './AssignedTasksBox.css';

// The "my tasks" side box: tasks assigned to me and not yet done, each linked
// to its project, with a status dot and due date.
export default function AssignedTasksBox({ tasks }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  return (
    <section className="mp__box">
      <h2 className="mp__box-title">{t('myProjects.tasksTitle')}</h2>
      {tasks.length === 0 ? (
        <p className="mp__box-empty">{t('myProjects.tasksEmpty')}</p>
      ) : (
        <ul className="mp__tasks bayn-scroll">
          {tasks.map((task) => {
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
  );
}
