import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SendHorizontal from '@/assets/icons/send-horizontal.svg?react';
import X from '@/assets/icons/x.svg?react';
import useDraggable from '@/shared/hooks/useDraggable';
import { useConversation } from '../hooks/useConversation';

// A floating 1-on-1 direct-message window (bottom corner). `peer` is the other
// person (a ProjectMemberResponse); `conversation` is the direct room.
export default function DirectChatWindow({ conversation, peer, currentUserId, locale, onClose }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);
  const windowRef = useRef(null);
  const { messages, loading, send } = useConversation(conversation?.id);
  // The window can be dragged around by its title bar, and stays where it's put.
  const drag = useDraggable(windowRef, { storageKey: 'bayn.dm.pos' });

  const peerName = ((locale === 'ar' ? peer?.name_ar : peer?.name_en) || peer?.username || '').trim();
  const peerInitial = (peerName || '?').charAt(0).toUpperCase();
  const fmtTime = (iso) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    if (send(text)) setDraft('');
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div
      className={`dm${drag.dragging ? ' dm--dragging' : ''}`}
      role="dialog"
      aria-label={peerName}
      ref={windowRef}
      style={drag.style || undefined}
    >
      {/* Double-click the bar to send the window back to its default corner. */}
      <header className="dm__head" onDoubleClick={drag.reset} {...drag.handleProps}>
        <span className="dm__head-avatar" aria-hidden="true">
          {peer?.avatar_url ? <img src={peer.avatar_url} alt="" /> : peerInitial}
        </span>
        <span className="dm__head-name">{peerName}</span>
        <button type="button" className="dm__close" onClick={onClose} aria-label={t('teamChat.close')}>
          <X width={18} height={18} aria-hidden="true" />
        </button>
      </header>

      <div className="dm__messages bayn-scroll" ref={scrollRef}>
        {loading ? (
          <p className="dm__empty">{t('teamChat.loading')}</p>
        ) : messages.length === 0 ? (
          <p className="dm__empty">{t('directChat.empty')}</p>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === currentUserId;
            const cont = i > 0 && messages[i - 1].sender_id === m.sender_id;
            const next = messages[i + 1];
            const contBelow = next && next.sender_id === m.sender_id;
            const showTime =
              !next ||
              next.sender_id !== m.sender_id ||
              fmtTime(next.created_at) !== fmtTime(m.created_at);
            return (
              <div
                key={m.id}
                className={`dm__msg${mine ? ' dm__msg--mine' : ''}${cont ? ' dm__msg--cont' : ''}${
                  contBelow ? ' dm__msg--cont-below' : ''
                }`}
              >
                {/* bdi isolates the text's own direction so the bubble corners
                    still follow the page layout, not the message language. */}
                <span className="dm__msg-text">
                  <bdi>{m.content}</bdi>
                  {showTime && <span className="dm__msg-time">{fmtTime(m.created_at)}</span>}
                </span>
              </div>
            );
          })
        )}
      </div>

      <form
        className="dm__compose"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          className="dm__input bayn-scroll"
          dir="auto"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('teamChat.placeholder')}
        />
        <button type="submit" className="dm__send" aria-label={t('teamChat.send')} disabled={!draft.trim()}>
          <SendHorizontal width={20} height={20} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
