import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SendHorizontal from '@/assets/icons/send-horizontal.svg?react';
import './TeamChat.css';

// Persistent team-chat rail pinned to the side of the project dashboard. This is
// the UI shell — messages are placeholder/local for now; it gets wired to the
// chat REST + WebSocket API once the backend chat feature is fixed.
export default function TeamChat({ project, team = [], currentUserId, locale }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState([]);
  const scrollRef = useRef(null);

  const nameOf = (m) => ((locale === 'ar' ? m?.name_ar : m?.name_en) || '').trim();
  const initialOf = (m) => (nameOf(m) || '?').charAt(0).toUpperCase();

  // Seed a few sample messages from real teammates so the layout is visible.
  const others = team.filter((m) => m.user_id !== currentUserId).slice(0, 2);
  const placeholders = others.length
    ? [
        { id: 'p1', mine: false, sender: others[0], text: t('teamChat.sample1') },
        { id: 'p2', mine: true, text: t('teamChat.sample2') },
        ...(others[1] ? [{ id: 'p3', mine: false, sender: others[1], text: t('teamChat.sample3') }] : []),
      ]
    : [];
  const messages = [...placeholders, ...sent];

  // Keep the view pinned to the newest message.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setSent((s) => [...s, { id: `local-${s.length}`, mine: true, text }]);
    setDraft('');
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
        {messages.length === 0 ? (
          <p className="tc__empty">{t('teamChat.empty')}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`tc__msg${m.mine ? ' tc__msg--mine' : ''}`}>
              {!m.mine && (
                <span className="tc__msg-avatar" aria-hidden="true">
                  {m.sender?.avatar_url ? <img src={m.sender.avatar_url} alt="" /> : initialOf(m.sender)}
                </span>
              )}
              <div className="tc__bubble">
                {!m.mine && m.sender && <span className="tc__msg-name">{nameOf(m.sender)}</span>}
                <span className="tc__msg-text">{m.text}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <form className="tc__compose" onSubmit={send}>
        <input
          className="tc__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('teamChat.placeholder')}
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
