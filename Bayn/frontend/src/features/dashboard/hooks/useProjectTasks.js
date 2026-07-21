import { useState, useEffect, useCallback } from 'react';
import { listProjectTasks } from '@/features/projects/services/projectService';

// Loads a project's task board and exposes a `reload` the caller runs after any
// create/update/delete so the board reflects the latest server state.
export function useProjectTasks(projectId) {
  const [tasks, setTasks] = useState([]);
  const [tasksError, setTasksError] = useState(false);

  const reload = useCallback(() => {
    if (!projectId) {
      setTasks([]);
      return Promise.resolve();
    }
    return listProjectTasks(projectId)
      .then((rows) => {
        setTasks(rows || []);
        setTasksError(false);
      })
      .catch(() => {
        setTasks([]);
        setTasksError(true);
      });
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { tasks, tasksError, reload };
}
