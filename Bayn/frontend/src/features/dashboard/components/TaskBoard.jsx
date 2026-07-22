import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Plus from '@/assets/icons/plus.svg?react';
import { STATUS_COLUMNS, STATUS_LABEL_KEY, PRIORITY_LABEL_KEY, groupTasksByStatus } from '../lib/tasks';
import './TaskBoard.css';

// The kanban task board: three status columns of task cards, plus an owner-only
// "new task" trigger. Reads real tasks; mutations happen through the sheet.
export default function TaskBoard({ tasks, tasksError, isOwner, memberById, locale, onNewTask, onOpenTask }) {
  const { t } = useTranslation();
  const now = Date.now();
  const byStatus = useMemo(() => groupTasksByStatus(tasks), [tasks]);

  return (
    <section className="pd__panel">
      <div className="pd__panel-head">
        <h3>{t('projectDashboard.tasks')}</h3>
        {isOwner && (
          <button type="button" className="pd__panel-link" onClick={onNewTask}>
            <Plus width={16} height={16} aria-hidden="true" />
            {t('projectDashboard.newTask')}
          </button>
        )}
      </div>

      {tasksError ? (
        <p className="pd__empty">{t('projectDashboard.tasksUnavailable')}</p>
      ) : (
        <div className="pd__board">
          {STATUS_COLUMNS.map((status) => (
            <div key={status} className="pd__col">
              <div className="pd__col-head">
                {t(STATUS_LABEL_KEY[status])}
                <span className="pd__col-count">{byStatus[status].length}</span>
              </div>
              {byStatus[status].length === 0 ? (
                <p className="pd__col-empty">{t('projectDashboard.noTasks')}</p>
              ) : (
                byStatus[status].map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    status={status}
                    now={now}
                    locale={locale}
                    assignee={memberById(task.assigned_to?.[0])}
                    onOpen={() => onOpenTask(task)}
                    t={t}
                  />
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TaskCard({ task, status, now, locale, assignee, onOpen, t }) {
  const overdue = task.due_date && new Date(task.due_date).getTime() < now && status !== 'done';
  const priority = (task.priority || 'low').toLowerCase();
  const name = assignee
    ? (locale === 'ar' ? assignee.name_ar : assignee.name_en)
    : t('projectDashboard.taskAssigneeNone');
  const initial = (assignee ? name : '?').trim().charAt(0).toUpperCase();

  return (
    <div className="pd__task-card">
      <p className="pd__task-title">{task.title}</p>
      <div className="pd__task-meta">
        <span className={`pd__priority pd__priority--${priority}`}>{t(PRIORITY_LABEL_KEY[priority])}</span>
        {task.due_date && (
          <span className={`pd__due${overdue ? ' pd__due--overdue' : ''}`}>
            {overdue ? `${t('projectDashboard.overdue')} · ` : ''}
            {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(task.due_date))}
          </span>
        )}
      </div>
      <div className="pd__task-foot">
        <span className="pd__task-assignee">
          <span className="pd__task-avatar" aria-hidden="true">
            {assignee?.avatar_url ? (
              <img src={assignee.avatar_url} alt="" />
            ) : (
              <span className="pd__task-avatar-fallback">{initial}</span>
            )}
          </span>
          <span className="pd__task-assignee-name">{name}</span>
        </span>
        <button type="button" className="pd__task-details" onClick={onOpen}>
          {t('projectDashboard.taskViewDetails')}
        </button>
      </div>
    </div>
  );
}
