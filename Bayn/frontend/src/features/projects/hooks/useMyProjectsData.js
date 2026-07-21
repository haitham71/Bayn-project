import { useState, useEffect } from 'react';
import { getMyProjects, listAssignedTasks } from '@/features/projects/services/projectService';
import { listMeetings } from '@/features/meetings/services/meetingService';
import { MAX_PROJECTS } from '../lib/projects';

// Data for the My Projects page: the projects I own vs work on, my confirmed
// meetings, and my open assigned tasks across all of them.
export function useMyProjectsData(userId) {
  const [meetings, setMeetings] = useState([]);
  const [owned, setOwned] = useState([]);
  const [working, setWorking] = useState([]);
  const [myTasks, setMyTasks] = useState([]);

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
    if (!working.length || !userId) { setMyTasks([]); return; }
    listAssignedTasks(working, userId, { includeDone: false }).then(setMyTasks);
  }, [working, userId]);

  // working holds every membership, so its length counts toward the cap.
  const atLimit = working.length >= MAX_PROJECTS;

  return { meetings, owned, working, myTasks, atLimit };
}
