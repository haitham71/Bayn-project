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

// ---- Tasks (flat /tasks resource; project scoping via query param) ----

// A project's tasks. Optional filter, e.g. { status }.
export const listProjectTasks = (projectId, params) =>
  api.get(API.tasks.base, { params: { project_id: projectId, ...params } }).then((r) => r.data);

// Create a task (owner or a granted editor).
export const createProjectTask = (payload) =>
  api.post(API.tasks.base, payload).then((r) => r.data);

// Full update of a task — owner or a granted editor only.
export const updateProjectTask = (taskId, payload) =>
  api.put(`${API.tasks.base}/${taskId}`, payload).then((r) => r.data);

// Member edit: toggle status and/or push the deadline later (any member).
export const updateTaskAsMember = (taskId, payload) =>
  api.patch(`${API.tasks.base}/${taskId}`, payload).then((r) => r.data);

// Delete a task (owner or a granted editor).
export const deleteProjectTask = (taskId) =>
  api.delete(`${API.tasks.base}/${taskId}`).then((r) => r.data);

// Ids of the members the owner granted full task rights to (create, assign,
// delete). Readable by any member of the project.
export const listTaskEditors = (projectId) =>
  api.get(`${API.tasks.base}/editors`, { params: { project_id: projectId } }).then((r) => r.data);

// Owner: let a member hand out and manage tasks.
export const grantTaskEditor = (projectId, userId) =>
  api.post(`${API.tasks.base}/editors`, { project_id: projectId, user_id: userId }).then((r) => r.data);

// Owner: take that permission back.
export const revokeTaskEditor = (projectId, userId) =>
  api.delete(`${API.tasks.base}/editors/${projectId}/${userId}`).then((r) => r.data);

// Tasks assigned to `userId` across the given projects, each tagged with its
// project's title. There's no cross-project task endpoint, so this gathers each
// project's tasks and filters. Pass includeDone=false to drop finished tasks.
export const listAssignedTasks = (projects, userId, { includeDone = true } = {}) =>
  Promise.all(
    (projects || []).map((p) =>
      listProjectTasks(p.id)
        .then((rows) => (rows || []).map((task) => ({ ...task, projectTitle: p.title })))
        .catch(() => []),
    ),
  ).then((lists) =>
    lists
      .flat()
      .filter(
        (task) =>
          (task.assigned_to || []).includes(userId) &&
          (includeDone || (task.status || 'todo').toLowerCase() !== 'done'),
      ),
  );

// ── Project files (shared attachments) ───────────────────────────────────────
export const listProjectFiles = (projectId) =>
  api.get(`${API.projects.base}/${projectId}/files`).then((r) => r.data);

// Multipart upload — let the browser set the boundary. Field name is "file".
export const uploadProjectFile = (projectId, file) => {
  const form = new FormData();
  form.append('file', file);
  return api
    .post(`${API.projects.base}/${projectId}/files`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export const deleteProjectFile = (projectId, fileId) =>
  api.delete(`${API.projects.base}/${projectId}/files/${fileId}`).then((r) => r.data);
