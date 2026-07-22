// Task board vocabulary shared by the board, the sheet and the stat cards.

// TaskStatus enum from the backend model: TODO | IN_PROGRESS | DONE.
export const STATUS_COLUMNS = ['todo', 'in_progress', 'done'];

export const STATUS_LABEL_KEY = {
  todo: 'projectDashboard.statusTodo',
  in_progress: 'projectDashboard.statusInProgress',
  done: 'projectDashboard.statusDone',
};

// TaskPriority enum: LOW | MEDIUM | HIGH.
export const PRIORITY_LABEL_KEY = {
  low: 'projectDashboard.priorityLow',
  medium: 'projectDashboard.priorityMedium',
  high: 'projectDashboard.priorityHigh',
};

export const EMPTY_TASK_FORM = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  due_date: '',
  assigned_to: [],
};

// Group a flat task list into the three board columns by status.
export function groupTasksByStatus(tasks) {
  const map = { todo: [], in_progress: [], done: [] };
  tasks.forEach((task) => {
    const key = (task.status || 'todo').toLowerCase();
    if (map[key]) map[key].push(task);
  });
  return map;
}
