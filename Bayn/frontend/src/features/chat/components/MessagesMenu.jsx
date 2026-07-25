import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MessageSquare from '@/assets/icons/message-square-text.svg?react';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useVisiblePoll } from '@/shared/hooks/useVisiblePoll';
import { getMyProjects, listProjectMembers } from '@/features/projects/services/projectService';
import { createDirectConversation, getUnreadCount, listConversations } from '../services/chatService';
import DirectChatWindow from './DirectChatWindow';
import './Messages.css';

// Navbar messages button: opens a popover listing my teammates (across my
// projects); picking one opens a direct-message window with them.
export default function MessagesMenu() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';
  const { user } = useCurrentUser();

  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState(null); // null = not loaded yet
  const [opening, setOpening] = useState(false);
  const [active, setActive] = useState(null); // { conversation, peer }
  const [unread, setUnread] = useState(null); // { count, display }
  const [unreadByPeer, setUnreadByPeer] = useState({}); // peer user_id -> unread count
  const [lastAtByPeer, setLastAtByPeer] = useState({}); // peer user_id -> last message time
  const rootRef = useRef(null);

  const refreshUnread = () =>
    getUnreadCount({ directOnly: true })
      .then((d) => setUnread(d))
      .catch(() => {});

  // Poll my unread count so the button badge stays roughly current.
  useVisiblePoll(refreshUnread, 15000);

  // Load my teammates (unique members across all my projects, minus me) once.
  useEffect(() => {
    if (!open || contacts !== null) return;
    let alive = true;
    getMyProjects()
      .catch(() => [])
      .then(async (projects) => {
        const lists = await Promise.all(
          (projects || []).map((p) => listProjectMembers(p.id).catch(() => [])),
        );
        if (!alive) return;
        const byId = new Map();
        for (const list of lists) {
          for (const m of list || []) {
            if (m.user_id !== user?.id && !byId.has(m.user_id)) byId.set(m.user_id, m);
          }
        }
        setContacts([...byId.values()]);
      });
    return () => {
      alive = false;
    };
  }, [open, contacts, user?.id]);

  // While the popover is open, gather per-teammate unread count and last-message
  // time from my direct conversations (null title + exactly two members).
  useEffect(() => {
    if (!open) return;
    listConversations()
      .then((convs) => {
        const unreadMap = {};
        const lastAtMap = {};
        for (const c of convs || []) {
          if (c.title != null || c.members?.length !== 2) continue;
          const other = c.members.find((m) => m.user_id !== user?.id);
          if (!other) continue;
          if (c.unread_count > 0) unreadMap[other.user_id] = c.unread_count;
          if (c.last_message) lastAtMap[other.user_id] = c.last_message.created_at;
        }
        setUnreadByPeer(unreadMap);
        setLastAtByPeer(lastAtMap);
      })
      .catch(() => {});
  }, [open, user?.id]);

  // Close the popover on an outside click / Escape.
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

  async function openChat(peer) {
    setOpening(true);
    try {
      const conversation = await createDirectConversation(peer.user_id);
      setActive({ conversation, peer });
      setOpen(false);
      // Opening the room marks it read; reflect that on the badge shortly after.
      setTimeout(refreshUnread, 800);
    } catch {
      /* ignore — the button stays available to retry */
    } finally {
      setOpening(false);
    }
  }

  const contactName = (m) => ((locale === 'ar' ? m.name_ar : m.name_en) || m.username || '').trim();

  // Teammates with recent message activity float to the top.
  const sortedContacts = contacts
    ? [...contacts].sort((a, b) => {
        const ta = lastAtByPeer[a.user_id];
        const tb = lastAtByPeer[b.user_id];
        if (ta && tb) return new Date(tb) - new Date(ta);
        if (ta) return -1;
        if (tb) return 1;
        return 0;
      })
    : contacts;

  return (
    <div className="msg" ref={rootRef}>
      <button
        type="button"
        className="bayn-topbar__icon-btn"
        aria-label={t('home.messages')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MessageSquare width={24} height={24} aria-hidden="true" />
      </button>
      {unread?.count > 0 && (
        <span className="msg__badge" aria-hidden="true">{unread.display}</span>
      )}

      {open && (
        <div className="msg__popover" role="dialog" aria-label={t('directChat.title')}>
          <p className="msg__popover-title">{t('directChat.title')}</p>
          {contacts === null ? (
            <p className="msg__state">{t('directChat.loading')}</p>
          ) : contacts.length === 0 ? (
            <p className="msg__state">{t('directChat.noContacts')}</p>
          ) : (
            <ul className="msg__contacts bayn-scroll">
              {sortedContacts.map((m) => (
                <li key={m.user_id}>
                  <button
                    type="button"
                    className="msg__contact"
                    onClick={() => openChat(m)}
                    disabled={opening}
                  >
                    <span className="msg__contact-avatar" aria-hidden="true">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" />
                      ) : (
                        (contactName(m) || '?').charAt(0).toUpperCase()
                      )}
                    </span>
                    <span className="msg__contact-info">
                      <span className="msg__contact-name">{contactName(m) || '—'}</span>
                      {m.username && (
                        <span className="msg__contact-username" dir="ltr">@{m.username}</span>
                      )}
                    </span>
                    {unreadByPeer[m.user_id] > 0 && (
                      <span className="msg__contact-dot" aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {active && (
        <DirectChatWindow
          conversation={active.conversation}
          peer={active.peer}
          currentUserId={user?.id}
          locale={locale}
          onClose={() => {
            setActive(null);
            refreshUnread();
          }}
        />
      )}
    </div>
  );
}
