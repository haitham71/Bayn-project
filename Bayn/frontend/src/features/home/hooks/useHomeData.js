import { useState, useEffect } from 'react';
import { listMeetings } from '@/features/meetings/services/meetingService';
import { listProjects, getMyProjects, listAssignedTasks } from '@/features/projects/services/projectService';
import { REC_COUNT } from '../lib/constants';

// Top-level home data: my confirmed meetings, a random set of recommended
// public ideas, my projects, and my open assigned tasks. The team/applications
// cards fetch their own per-project detail.
export function useHomeData(userId) {
  const [meetings, setMeetings] = useState([]);
  const [recIdeas, setRecIdeas] = useState([]);
  const [myProjects, setMyProjects] = useState([]);
  const [myTasks, setMyTasks] = useState([]);

  useEffect(() => {
    listMeetings().then((rows) => setMeetings(rows || [])).catch(() => {});
  }, []);

  // Shuffled once on load so it stays put across the per-second clock re-renders.
  useEffect(() => {
    listProjects()
      .then((rows) => {
        const shuffled = [...(rows || [])].sort(() => Math.random() - 0.5);
        setRecIdeas(shuffled.slice(0, REC_COUNT));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getMyProjects().then((rows) => setMyProjects(rows || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!myProjects.length || !userId) { setMyTasks([]); return; }
    listAssignedTasks(myProjects, userId, { includeDone: false }).then(setMyTasks);
  }, [myProjects, userId]);

  return { meetings, recIdeas, myProjects, myTasks };
}
