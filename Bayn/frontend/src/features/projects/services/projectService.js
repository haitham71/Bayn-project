import api from '@/shared/lib/axios';
import { API } from '@/shared/constants/apiEndpoints';

// Creates a project (an "idea") owned by the signed-in user.
export const createProject = (payload) =>
  api.post(API.projects.base, payload).then((r) => r.data);

// The current user's projects (owned + joined), each with their role.
export const getMyProjects = () =>
  api.get(API.projects.mine).then((r) => r.data);

// A project's members with their public info (name, avatar, role).
export const listProjectMembers = (id) =>
  api.get(`${API.projects.base}/${id}/members`).then((r) => r.data);

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

// Owner: update a project (e.g. visibility). Backend exposes this as PUT with
// an all-optional body, so a partial payload updates just the given fields.
export const updateProject = (id, payload) =>
  api.put(`${API.projects.base}/${id}`, payload).then((r) => r.data);

// Owner: replace the project's available meeting slots.
export const replaceSlots = (id, slots) =>
  api.put(`${API.projects.base}/${id}/slots`, { slots }).then((r) => r.data);

// A project's tasks. `params` supports backend filters, e.g. { status, priority }.
export const getProjectTasks = (id, params) =>
  api.get(API.tasks.forProject(id), { params }).then((r) => r.data);

// Progress summary for a project's tasks: { percent_done, overdue_count, top_contributor }.
export const getProjectTaskProgress = (id) =>
  api.get(API.tasks.progress(id)).then((r) => r.data);

// Create a task on a project.
export const createProjectTask = (id, payload) =>
  api.post(API.tasks.forProject(id), payload).then((r) => r.data);

// Update a task (status, priority, assignee, etc.).
export const updateProjectTask = (id, taskId, payload) =>
  api.patch(`${API.tasks.forProject(id)}/${taskId}`, payload).then((r) => r.data);
