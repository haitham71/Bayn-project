import api from '@/shared/lib/axios';
import { API } from '@/shared/constants/apiEndpoints';

// Creates a project (an "idea") owned by the signed-in user.
export const createProject = (payload) =>
  api.post(API.projects.base, payload).then((r) => r.data);

// The current user's projects (owned + joined), each with their role.
export const getMyProjects = () =>
  api.get(API.projects.mine).then((r) => r.data);
