import api from '@/shared/lib/axios';
import { API } from '@/shared/constants/apiEndpoints';
import { getAccessToken } from '@/shared/lib/authToken';

// A project's single team group chat (get-or-create on the backend). Returns a
// ConversationResponse: { id, title, members: [{ user_id, user }], last_message }.
export const getProjectConversation = (projectId) =>
  api.get(`${API.chat.base}/project/${projectId}`).then((r) => r.data);

// A 1-on-1 direct conversation with another user (get-or-create).
export const createDirectConversation = (recipientId) =>
  api.post(`${API.chat.base}/direct`, { recipient_id: recipientId }).then((r) => r.data);

// All my conversations (each with members, last_message and unread_count).
export const listConversations = () =>
  api.get(API.chat.base).then((r) => r.data);

// Paginated message history for a conversation, oldest-first.
export const getMessages = (conversationId, { limit = 50, offset = 0 } = {}) =>
  api
    .get(`${API.chat.base}/${conversationId}/messages`, { params: { limit, offset } })
    .then((r) => r.data);

// My unread message count: { count, display }. Pass { directOnly: true } to
// count only 1-on-1 direct messages (team chats have their own notification).
export const getUnreadCount = ({ directOnly = false } = {}) =>
  api
    .get(`${API.chat.base}/unread-count`, { params: { direct_only: directOnly } })
    .then((r) => r.data);

// Marks a conversation read (advances my last_read_at → clears its unread).
export const markConversationRead = (conversationId) =>
  api.post(`${API.chat.base}/${conversationId}/read`).then((r) => r.data);

// Opens the realtime chat WebSocket. `onEvent` gets each parsed frame
// ({ event, data }). Returns the raw socket so the caller can close it.
export function openChatSocket(onEvent) {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const token = getAccessToken();
  const url = `${base.replace(/^http/, 'ws')}${API.chat.base}/ws?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);
  ws.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {
      /* ignore malformed frames */
    }
  };
  return ws;
}
