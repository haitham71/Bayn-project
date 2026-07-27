import { useEffect, useState } from 'react';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
} from '../services/notificationService';

// Notifications state for the navbar bell: polls the unread count, loads the
// list on demand, and marks items read. Returns
// { items, unread, loading, load, markRead, markAllRead }.
export function useNotifications() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const refreshUnread = () =>
    getUnreadCount()
      .then((d) => setUnread(d.count || 0))
      .catch(() => {});

  // Poll the unread count so the bell badge stays roughly current.
  useEffect(() => {
    refreshUnread();
    const id = setInterval(refreshUnread, 20000);
    return () => clearInterval(id);
  }, []);

  // Load the full list (called when the dropdown opens).
  function load() {
    setLoading(true);
    listNotifications()
      .then((rows) => {
        setItems(rows || []);
        setUnread((rows || []).filter((n) => !n.is_read).length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function markRead(id) {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    markNotificationRead(id).catch(() => {});
  }

  function markAllRead() {
    const hasUnread = items.some((n) => !n.is_read);
    if (!hasUnread) return;
    setItems((list) => list.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    markAllNotificationsRead().catch(() => {});
  }

  function remove(id) {
    const wasUnread = items.some((n) => n.id === id && !n.is_read);
    setItems((list) => list.filter((n) => n.id !== id));
    if (wasUnread) setUnread((u) => Math.max(0, u - 1));
    deleteNotification(id).catch(() => {});
  }

  function clearAll() {
    if (items.length === 0) return;
    setItems([]);
    setUnread(0);
    clearAllNotifications().catch(() => {});
  }

  return { items, unread, loading, load, markRead, markAllRead, remove, clearAll };
}
