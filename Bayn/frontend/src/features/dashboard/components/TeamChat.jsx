import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SendHorizontal from '@/assets/icons/send-horizontal.svg?react';
import { useTeamChat } from '@/features/chat/hooks/useTeamChat';
import './TeamChat.css';

// The active "@…" token right before the caret, or null. Returns the query text
// after @ (may be empty when the user just typed "@").
function mentionQueryAt(text, caret) {
  const match = text.slice(0, caret).match(/(?:^|\s)@([^\s@]*)$/);
  return match ? match[1] : null;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Team-chat card for the project dashboard, wired to the chat API + WebSocket.
export default function TeamChat({ project, currentUserId, locale }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const { messages, members, loading, send } = useTeamChat(project?.id);

  const personName = (s) =>
    (locale === 'ar'
      ? `${s?.first_name_ar || ''} ${s?.last_name_ar || ''}`
      : `${s?.first_name_en || ''} ${s?.last_name_en || ''}`
    ).trim();
  const initialOf = (s) => (personName(s) || s?.username || '?').charAt(0).toUpperCase();

  // Mentionable teammates (everyone in the room but me).
  const candidates = members
    .filter((m) => m.user_id !== currentUserId)
    .map((m) => ({
      userId: m.user_id,
      username: m.user?.username || '',
      name: personName(m.user),
      avatarUrl: m.user?.avatar_url || null,
    }));

  const suggestions =
    mentionQuery === null
      ? []
      : candidates
          .filter((c) => {
            const q = mentionQuery.toLowerCase();
            return c.username.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
          })
          .slice(0, 6);

  // Highlights @mentions of real members inside a message's text.
  const usernameSet = new Set(members.map((m) => m.user?.username).filter(Boolean));
  function renderContent(text) {
    const re = /@([A-Za-z0-9_]+)/g;
    const out = [];
    let last = 0;
    let key = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
      if (!usernameSet.has(match[1])) continue;
      if (match.index > last) out.push(text.slice(last, match.index));
      out.push(
        <span key={`m${key++}`} className="tc__mention-tag" dir="ltr">
          @{match[1]}
        </span>,
      );
      last = re.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out.length ? out : text;
  }

  // Keep the view pinned to the newest message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  // Grow the compose box with its content, up to a few lines, then scroll.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [draft]);

  function onChange(e) {
    const val = e.target.value;
    setDraft(val);
    setMentionQuery(mentionQueryAt(val, e.target.selectionStart));
    setMentionIndex(0);
  }

  // Replaces the active "@query" with "@username " and closes the suggestions.
  function insertMention(c) {
    if (!c) return;
    const el = inputRef.current;
    const caret = el ? el.selectionStart : draft.length;
    const q = mentionQueryAt(draft, caret);
    if (q === null) return;
    const start = caret - q.length - 1; // index of '@'
    const before = draft.slice(0, start);
    const insert = `@${c.username} `;
    const next = `${before}${insert}${draft.slice(caret)}`;
    setDraft(next);
    setMentionQuery(null);
    const newCaret = before.length + insert.length;
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
      }
    });
  }

  // Collect the user ids of teammates actually @mentioned in the text.
  function collectMentions(text) {
    const ids = [];
    for (const c of candidates) {
      if (c.username && new RegExp(`@${escapeRe(c.username)}(?![\\w])`).test(text)) {
        ids.push(c.userId);
      }
    }
    return ids;
  }

  function submit() {
    const text = draft.trim();
    if (!text) return;
    if (send(text, collectMentions(text))) {
      setDraft('');
      setMentionQuery(null);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    submit();
  }

  function onKeyDown(e) {
    const open = mentionQuery !== null && suggestions.length > 0;
    if (open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(suggestions[mentionIndex] || suggestions[0]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <aside className="tc" aria-label={t('teamChat.title')}>
      <header className="tc__head">
        <div className="tc__head-info">
          <span className="tc__head-title">{t('teamChat.title')}</span>
          {project?.title && <span className="tc__head-sub">{project.title}</span>}
        </div>
      </header>

      <div className="tc__messages bayn-scroll" ref={scrollRef}>
        {loading ? (
          <p className="tc__empty">{t('teamChat.loading')}</p>
        ) : messages.length === 0 ? (
          <p className="tc__empty">{t('teamChat.empty')}</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === currentUserId;
            return (
              <div key={m.id} className={`tc__msg${mine ? ' tc__msg--mine' : ''}`}>
                {!mine && (
                  <span className="tc__msg-avatar" aria-hidden="true">
                    {m.sender?.avatar_url ? <img src={m.sender.avatar_url} alt="" /> : initialOf(m.sender)}
                  </span>
                )}
                <div className="tc__bubble">
                  {!mine && <span className="tc__msg-name">{personName(m.sender)}</span>}
                  <span className="tc__msg-text" dir="auto">{renderContent(m.content)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form className="tc__compose" onSubmit={onSubmit}>
        {mentionQuery !== null && suggestions.length > 0 && (
          <ul className="tc__mentions bayn-scroll">
            {suggestions.map((c, i) => (
              <li key={c.userId}>
                <button
                  type="button"
                  className={`tc__mention${i === mentionIndex ? ' tc__mention--active' : ''}`}
                  onMouseEnter={() => setMentionIndex(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(c);
                  }}
                >
                  <span className="tc__mention-avatar" aria-hidden="true">
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt="" />
                    ) : (
                      (c.name || c.username || '?').charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="tc__mention-name">{c.name || c.username}</span>
                  <span className="tc__mention-username" dir="ltr">@{c.username}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <textarea
          ref={inputRef}
          className="tc__input bayn-scroll"
          dir="auto"
          value={draft}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={t('teamChat.placeholder')}
          rows={1}
        />
        <button
          type="submit"
          className="tc__send"
          aria-label={t('teamChat.send')}
          disabled={!draft.trim()}
        >
          <SendHorizontal width={20} height={20} aria-hidden="true" />
        </button>
      </form>
    </aside>
  );
}
