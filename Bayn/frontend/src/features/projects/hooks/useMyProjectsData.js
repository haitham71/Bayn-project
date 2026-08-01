import { useState, useEffect, useMemo } from 'react';
import { getMyProjects, listProjectMembers, listProjectTasks } from '@/features/projects/services/projectService';
import { listMeetings } from '@/features/meetings/services/meetingService';
import { MAX_PROJECTS } from '../lib/projects';

const isOpen = (task) => (task.status || 'todo').toLowerCase() !== 'done';

// Data for the My Projects page: the projects I own vs work on, my confirmed
// meetings, my open assigned tasks across all of them, and the per-project
// team + task counts the working cards show at a glance.
export function useMyProjectsData(userId) {
  const [meetings, setMeetings] = useState([]);
  const [owned, setOwned] = useState([]);
  const [working, setWorking] = useState([]);
  // { [projectId]: { title, tasks, members } } — one fetch per project, reused
  // for both the assigned-tasks box and each card's summary.
  const [details, setDetails] = useState({});

  useEffect(() => {
    listMeetings().then((rows) => setMeetings(rows || [])).catch(() => {});
  }, []);

  useEffect(() => {
    getMyProjects()
      .then((rows) => {
        // "You own" = projects you lead; "you work on" = every project you're
        // part of, including the ones you own.
        setOwned(rows.filter((p) => p.role === 'owner'));
        setWorking(rows);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!working.length) { setDetails({}); return undefined; }
    let alive = true;
    Promise.all(
      working.map((p) =>
        Promise.all([
          listProjectTasks(p.id).catch(() => []),
          listProjectMembers(p.id).catch(() => []),
        ]).then(([tasks, members]) => [p.id, { title: p.title, tasks: tasks || [], members: members || [] }]),
      ),
    ).then((pairs) => {
      if (alive) setDetails(Object.fromEntries(pairs));
    });
    return () => { alive = false; };
  }, [working]);

  // Open tasks assigned to me, tagged with the project they belong to.
  const myTasks = useMemo(() => {
    if (!userId) return [];
    return Object.values(details).flatMap(({ title, tasks }) =>
      tasks
        .filter((task) => (task.assigned_to || []).includes(userId) && isOpen(task))
        .map((task) => ({ ...task, projectTitle: title })),
    );
  }, [details, userId]);

  // What a project card shows: who's on the team and how many tasks are still open.
  const projectStats = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(details).map(([id, d]) => [
          id,
          { members: d.members, openTasks: d.tasks.filter(isOpen).length },
        ]),
      ),
    [details],
  );

  // working holds every membership, so its length counts toward the cap.
  const atLimit = working.length >= MAX_PROJECTS;

  return { meetings, owned, working, myTasks, projectStats, atLimit };
}
