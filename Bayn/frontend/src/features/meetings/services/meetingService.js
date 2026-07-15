import api from '@/shared/lib/axios';
import { API } from '@/shared/constants/apiEndpoints';

// A joiner asks to join a project by picking one of its published slots.
export const createJoinRequest = (payload) =>
  api.post(API.meetings.joinRequests, payload).then((r) => r.data);

// Meeting requests addressed to me as owner ("incoming") or that I sent ("outgoing").
export const listMeetingRequests = (role, projectId) =>
  api.get(API.meetings.requests, { params: { role, project_id: projectId } }).then((r) => r.data);

// Takes the proposed slot and sends both parties the NDA. Does not schedule the
// meeting — that happens on its own once both have signed.
export const acceptMeetingRequest = (requestId) =>
  api.post(`${API.meetings.requests}/${requestId}/accept`).then((r) => r.data);

export const rejectMeetingRequest = (requestId) =>
  api.post(`${API.meetings.requests}/${requestId}/reject`).then((r) => r.data);

// The owner's call after the meeting: approve registers the requester as a
// project member, decline leaves them out.
export const finalizeMeetingRequest = (requestId, approve) =>
  api.post(`${API.meetings.requests}/${requestId}/finalize`, { approve }).then((r) => r.data);

// My confirmed meetings.
export const listMeetings = () =>
  api.get(API.meetings.base).then((r) => r.data);
