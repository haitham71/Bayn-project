import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import CalendarPicker from '@/shared/components/Calendar';
import Select from '@/shared/components/Select';
import Button from '@/shared/components/Button';
import AssigneePicker from './AssigneePicker';
import Users from '@/assets/icons/users.svg?react';
import LoaderCircle from '@/assets/icons/loader-circle.svg?react';
import Flag from '@/assets/icons/flag.svg?react';
import Calendar from '@/assets/icons/calendar.svg?react';
import AlignLeft from '@/assets/icons/align-left.svg?react';
import Trash2 from '@/assets/icons/trash-2.svg?react';
import X from '@/assets/icons/x.svg?react';
import {
  createProjectTask,
  updateProjectTask,
  updateTaskAsMember,
  deleteProjectTask,
} from '@/features/projects/services/projectService';
import { STATUS_COLUMNS, STATUS_LABEL_KEY, PRIORITY_LABEL_KEY, EMPTY_TASK_FORM } from '../lib/tasks';
import { toDateStr, parseDateStr } from '../lib/dates';
import './TaskSheet.css';

function formFromTask(task) {
  if (!task) return EMPTY_TASK_FORM;
  return {
    title: task.title || '',
    description: task.description || '',
    priority: (task.priority || 'medium').toLowerCase(),
    status: (task.status || 'todo').toLowerCase(),
    due_date: task.due_date ? toDateStr(new Date(task.due_date)) : '',
    assigned_to: Array.isArray(task.assigned_to) ? [...task.assigned_to] : [],
  };
}

// Notion-style side sheet to create a task, or view/edit an existing one.
// Permission tiers: the owner edits everything; a non-owner assignee may change
// the status only; anyone else views read-only.
export default function TaskSheet({ open, task, projectId, team, isOwner, currentUserId, locale, onClose, onSaved }) {
  const { t } = useTranslation();
  const editingTaskId = task?.id ?? null;

  const [form, setForm] = useState(EMPTY_TASK_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDueCal, setShowDueCal] = useState(false);
  const dueRef = useRef(null);

  // Re-seed the form each time the sheet opens for a (different) task.
  useEffect(() => {
    if (open) {
      setForm(formFromTask(task));
      setError('');
      setConfirmDelete(false);
      setShowDueCal(false);
    }
  }, [open, task]);

  // Close the due-date calendar when clicking outside it.
  useEffect(() => {
    if (!showDueCal) return undefined;
    function onDocClick(e) {
      if (dueRef.current && !dueRef.current.contains(e.target)) setShowDueCal(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showDueCal]);

  if (!open) return null;

  const isAssignee = Boolean(editingTaskId) && form.assigned_to.includes(currentUserId);
  const canEditStatus = isOwner || isAssignee;
  const sheetAssignees = team.filter((m) => form.assigned_to.includes(m.user_id));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || saving) return;
    setSaving(true);
    setError('');
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      assigned_to: form.assigned_to,
    };
    try {
      if (editingTaskId) {
        if (isOwner) await updateProjectTask(editingTaskId, payload);
        else await updateTaskAsMember(editingTaskId, { status: form.status });
      } else {
        await createProjectTask({ project_id: projectId, ...payload });
      }
      onSaved();
    } catch {
      setError(t(editingTaskId ? 'projectDashboard.taskUpdateFailed' : 'projectDashboard.taskCreateFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingTaskId || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await deleteProjectTask(editingTaskId);
      onSaved();
    } catch {
      setError(t('projectDashboard.taskDeleteFailed'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="pd__sheet-overlay" onClick={() => !saving && onClose()}>
      <div className="pd__sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="pd__sheet-bar">
          <button
            type="button"
            className="pd__sheet-close"
            onClick={() => !saving && onClose()}
            aria-label={t('projectDashboard.taskCancel')}
          >
            <X width={18} height={18} aria-hidden="true" />
          </button>
        </div>

        <form className="pd__sheet-body" onSubmit={handleSubmit}>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            className="pd__sheet-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={t('projectDashboard.newTaskTitle')}
            readOnly={!isOwner}
            autoFocus={!editingTaskId}
          />

          <div className="pd__sheet-props">
            <div className="pd__prop pd__prop--assignees">
              <span className="pd__prop-label"><Users width={15} height={15} aria-hidden="true" />{t('projectDashboard.taskAssigneeLabel')}</span>
              {isOwner ? (
                <AssigneePicker
                  team={team}
                  value={form.assigned_to}
                  onChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}
                  locale={locale}
                  placeholder={t('projectDashboard.taskAssigneeNone')}
                />
              ) : sheetAssignees.length > 0 ? (
                <span className="pd__prop-people">
                  {sheetAssignees.map((m) => {
                    const name = locale === 'ar' ? m.name_ar : m.name_en;
                    return (
                      <span key={m.user_id} className="pd__assignees-chip">
                        <span className="pd__assignee-avatar" aria-hidden="true">
                          {m.avatar_url ? (
                            <img src={m.avatar_url} alt="" />
                          ) : (
                            <span className="pd__assignee-avatar-fallback">{name.trim().charAt(0).toUpperCase()}</span>
                          )}
                        </span>
                        <span className="pd__assignees-chip-name">{name}</span>
                      </span>
                    );
                  })}
                </span>
              ) : (
                <span className="pd__prop-value pd__prop-value--muted">{t('projectDashboard.taskAssigneeNone')}</span>
              )}
            </div>
            <div className="pd__prop">
              <span className="pd__prop-label"><LoaderCircle width={15} height={15} aria-hidden="true" />{t('projectDashboard.taskStatusLabel')}</span>
              {canEditStatus ? (
                <Select
                  label=""
                  value={form.status}
                  onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                  options={STATUS_COLUMNS.map((s) => ({ value: s, label: t(STATUS_LABEL_KEY[s]) }))}
                  className="pd__prop-control"
                />
              ) : (
                <span className="pd__prop-value">
                  <span className={`pd__status-tag pd__status-tag--${form.status}`}>
                    <span className="pd__status-dot" />
                    {t(STATUS_LABEL_KEY[form.status] || STATUS_LABEL_KEY.todo)}
                  </span>
                </span>
              )}
            </div>
            <div className="pd__prop">
              <span className="pd__prop-label"><Flag width={15} height={15} aria-hidden="true" />{t('projectDashboard.taskPriorityLabel')}</span>
              {isOwner ? (
                <Select
                  label=""
                  value={form.priority}
                  onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                  options={['low', 'medium', 'high'].map((p) => ({ value: p, label: t(PRIORITY_LABEL_KEY[p]) }))}
                  className="pd__prop-control"
                />
              ) : (
                <span className="pd__prop-value">
                  <span className={`pd__priority pd__priority--${form.priority || 'low'}`}>
                    {t(PRIORITY_LABEL_KEY[form.priority] || PRIORITY_LABEL_KEY.low)}
                  </span>
                </span>
              )}
            </div>
            <div className="pd__prop">
              <span className="pd__prop-label"><Calendar width={15} height={15} aria-hidden="true" />{t('projectDashboard.taskDueLabel')}</span>
              {isOwner ? (
                <div className="pd__datewrap" ref={dueRef}>
                  <button
                    type="button"
                    className={`pd__datebtn${form.due_date ? '' : ' pd__datebtn--empty'}`}
                    onClick={() => setShowDueCal((o) => !o)}
                  >
                    <span>
                      {form.due_date
                        ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(parseDateStr(form.due_date))
                        : t('projectDashboard.taskDuePh')}
                    </span>
                    <Calendar width={16} height={16} aria-hidden="true" />
                  </button>
                  {showDueCal && (
                    <div className="pd__datepop">
                      <CalendarPicker
                        className="pd__calendar-inline"
                        initialDate={form.due_date ? parseDateStr(form.due_date) : new Date()}
                        selectedDates={form.due_date ? [parseDateStr(form.due_date)] : []}
                        onSelectDate={(d) => { setForm((f) => ({ ...f, due_date: toDateStr(d) })); setShowDueCal(false); }}
                      />
                      {form.due_date && (
                        <button
                          type="button"
                          className="pd__date-clear"
                          onClick={() => { setForm((f) => ({ ...f, due_date: '' })); setShowDueCal(false); }}
                        >
                          {t('projectDashboard.taskDateClear')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <span className={`pd__prop-value${form.due_date ? '' : ' pd__prop-value--muted'}`}>
                  {form.due_date
                    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(parseDateStr(form.due_date))
                    : t('projectDashboard.taskDuePh')}
                </span>
              )}
            </div>
          </div>

          <hr className="pd__sheet-divider" />

          <div className="pd__sheet-desc">
            <span className="pd__prop-label"><AlignLeft width={15} height={15} aria-hidden="true" />{t('projectDashboard.taskDescLabel')}</span>
            {isOwner ? (
              <textarea
                className="pd__sheet-textarea"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t('projectDashboard.taskDescPh')}
                rows={6}
              />
            ) : (
              <p className={`pd__sheet-desc-text${form.description ? '' : ' pd__sheet-desc-text--empty'}`}>
                {form.description || t('projectDashboard.taskNoDesc')}
              </p>
            )}
          </div>

          {error && <p className="pd__modal-error">{error}</p>}

          {confirmDelete ? (
            <div className="pd__sheet-confirm">
              <span className="pd__sheet-confirm-msg">{t('projectDashboard.taskDeleteConfirm')}</span>
              <div className="pd__sheet-confirm-btns">
                <Button type="button" variant="tertiary" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  {t('projectDashboard.taskCancel')}
                </Button>
                <button type="button" className="pd__sheet-delete-confirm" onClick={handleDelete} disabled={deleting}>
                  {deleting ? t('projectDashboard.taskDeleting') : t('projectDashboard.taskDelete')}
                </button>
              </div>
            </div>
          ) : (
            <div className="pd__sheet-actions">
              {isOwner && editingTaskId && (
                <button type="button" className="pd__sheet-delete" onClick={() => setConfirmDelete(true)}>
                  <Trash2 width={15} height={15} aria-hidden="true" />
                  {t('projectDashboard.taskDelete')}
                </button>
              )}
              <div className="pd__sheet-actions-end">
                <Button type="button" variant="tertiary" size="sm" onClick={onClose} disabled={saving}>
                  {canEditStatus ? t('projectDashboard.taskCancel') : t('projectDashboard.taskClose')}
                </Button>
                {canEditStatus && (
                  <Button type="submit" size="sm" disabled={!form.title.trim() || saving}>
                    {editingTaskId
                      ? (saving ? t('projectDashboard.taskSaving') : t('projectDashboard.taskSave'))
                      : (saving ? t('projectDashboard.taskCreating') : t('projectDashboard.taskCreate'))}
                  </Button>
                )}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
