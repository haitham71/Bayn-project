import api from '@/shared/lib/axios';
import { API } from '@/shared/constants/apiEndpoints';

// Creates a project (an "idea") owned by the signed-in user.
export const createProject = (payload) =>
  api.post(API.projects.base, payload).then((r) => r.data);

// The current user's projects (owned + joined), each with their role.
export const getMyProjects = () =>
  api.get(API.projects.mine).then((r) => r.data);

// All visible projects — the public ideas marketplace.
export const listProjects = () =>
  api.get(API.projects.base).then((r) => r.data);

// A single project (idea) by id.
export const getProject = (id) =>
  api.get(`${API.projects.base}/${id}`).then((r) => r.data);

// Joining isn't self-service — membership is granted by the owner after a
// signed NDA and a meeting. Start with createJoinRequest in meetingService.

// A project's available meeting slots (for joiners to pick from).
export const getProjectSlots = (id) =>
  api.get(`${API.projects.base}/${id}/slots`).then((r) => r.data);

// Owner: partial-update a project (e.g. visibility).
export const updateProject = (id, payload) =>
  api.patch(`${API.projects.base}/${id}`, payload).then((r) => r.data);

// Owner: replace the project's available meeting slots.
export const replaceSlots = (id, slots) =>
  api.put(`${API.projects.base}/${id}/slots`, { slots }).then((r) => r.data);
