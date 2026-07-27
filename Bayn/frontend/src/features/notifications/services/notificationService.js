import api from '@/shared/lib/axios';

const BASE = '/notifications';

// My notifications, newest first. Each carries a pre-localized `message`.
export const listNotifications = ({ limit = 30, offset = 0 } = {}) =>
  api.get(BASE, { params: { limit, offset } }).then((r) => r.data);

// My unread notification count: { count, display }.
export const getUnreadCount = () => api.get(`${BASE}/unread-count`).then((r) => r.data);

// Marks a single notification read.
export const markNotificationRead = (id) =>
  api.put(`${BASE}/${id}/read`).then((r) => r.data);

// Marks all of my notifications read.
export const markAllNotificationsRead = () => api.put(`${BASE}/read-all`).then((r) => r.data);

// Deletes a single notification.
export const deleteNotification = (id) => api.delete(`${BASE}/${id}`).then((r) => r.data);

// Clears all of my notifications.
export const clearAllNotifications = () => api.delete(BASE).then((r) => r.data);
