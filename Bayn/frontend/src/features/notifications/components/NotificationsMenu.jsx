import { useEffect, useRef, useState } from 'react';
import { useLangNavigate } from '@/shared/hooks/useLang';
import { useTranslation } from 'react-i18next';
import Bell from '@/assets/icons/bell.svg?react';
import Calendar from '@/assets/icons/calendar.svg?react';
import CheckSquare from '@/assets/icons/check-square.svg?react';
import X from '@/assets/icons/x.svg?react';
import { timeAgo } from '@/shared/lib/relativeTime';
import { useNotifications } from '../hooks/useNotifications';
import './Notifications.css';

const isMeeting = (type) => (type || '').startsWith('meeting');

// Where clicking a notification takes you, based on its type + linked ids.
function linkFor(n) {
  switch (n.type) {
    case 'task_assigned':
      return n.project_id ? `/projects/${n.project_id}/dashboard` : null;
    case 'meeting_request_received':
      return n.project_id ? `/join-requests/${n.project_id}` : '/join-requests';
    case 'meeting_request_accepted':
    case 'meeting_request_rejected':
    case 'meeting_scheduled':
    case 'meeting_cancelled':
      return '/meetings';
    default:
      return null;
  }
}

export default function NotificationsMenu() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  const navigate = useLangNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const { items, unread, loading, load, markRead, markAllRead, remove, clearAll } = useNotifications();

  // Clicking a notification marks it read, closes the menu, and jumps to its target.
  function openNotification(n) {
    if (!n.is_read) markRead(n.id);
    setOpen(false);
    const link = linkFor(n);
    if (link) navigate(link);
  }

  // Load the list each time the dropdown opens.
  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="ntf" ref={rootRef}>
      <button
        type="button"
        className="bayn-topbar__icon-btn"
        aria-label={t('home.notifications')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell width={24} height={24} aria-hidden="true" />
      </button>
      {unread > 0 && <span className="ntf__badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}

      {open && (
        <div className="ntf__popover" role="dialog" aria-label={t('notifications.title')}>
          <div className="ntf__head">
            <span className="ntf__title">{t('notifications.title')}</span>
            <div className="ntf__actions">
              {unread > 0 && (
                <button type="button" className="ntf__link" onClick={markAllRead}>
                  {t('notifications.markAllRead')}
                </button>
              )}
              {items.length > 0 && (
                <button type="button" className="ntf__link" onClick={clearAll}>
                  {t('notifications.clearAll')}
                </button>
              )}
            </div>
          </div>

          {loading && items.length === 0 ? (
            <p className="ntf__empty">{t('notifications.loading')}</p>
          ) : items.length === 0 ? (
            <p className="ntf__empty">{t('notifications.empty')}</p>
          ) : (
            <ul className="ntf__list bayn-scroll">
              {items.map((n) => {
                const Icon = isMeeting(n.type) ? Calendar : CheckSquare;
                return (
                  <li key={n.id} className={`ntf__row${n.is_read ? '' : ' ntf__row--unread'}`}>
                    <button
                      type="button"
                      className="ntf__item"
                      onClick={() => openNotification(n)}
                    >
                      <span className={`ntf__icon ntf__icon--${isMeeting(n.type) ? 'meeting' : 'task'}`}>
                        <Icon width={16} height={16} aria-hidden="true" />
                      </span>
                      <span className="ntf__body">
                        <span className="ntf__text">{n.message}</span>
                        <span className="ntf__time">{timeAgo(n.created_at, locale)}</span>
                      </span>
                      {!n.is_read && <span className="ntf__dot" aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      className="ntf__close"
                      onClick={() => remove(n.id)}
                      aria-label={t('notifications.dismiss')}
                    >
                      <X width={14} height={14} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
