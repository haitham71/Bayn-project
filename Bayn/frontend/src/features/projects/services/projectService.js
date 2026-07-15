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

// Join a project as a member.
export const joinProject = (id) =>
  api.post(`${API.projects.base}/${id}/join`).then((r) => r.data);
