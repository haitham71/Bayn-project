import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import X from '@/assets/icons/x.svg?react';
import SendHorizontal from '@/assets/icons/send-horizontal.svg?react';

// Right-hand chat panel — live, in-call messages over Daily's data channel.
export default function CallChatPanel({ open, messages, onSend, onClose }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, open]);

  if (!open) return null;

  function submit(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
  }

  return (
    <aside className="cr__chat">
      <header className="cr__chat-head">
        <span>{t('meetingRoom.chat')}</span>
        <button type="button" className="cr__chat-close" onClick={onClose} aria-label={t('meetingRoom.closeChat')}>
          <X width={18} height={18} />
        </button>
      </header>

      <div className="cr__chat-list bayn-scroll" ref={listRef}>
        {messages.length === 0 ? (
          <p className="cr__chat-empty">{t('meetingRoom.chatEmpty')}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`cr__msg${m.local ? ' cr__msg--me' : ''}`}>
              <span className="cr__msg-name">{m.local ? t('meetingRoom.you') : (m.name || t('meetingRoom.guest'))}</span>
              <span className="cr__msg-text">{m.text}</span>
            </div>
          ))
        )}
      </div>

      <form className="cr__chat-form" onSubmit={submit}>
        <input
          type="text"
          className="cr__chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('meetingRoom.chatPlaceholder')}
          maxLength={500}
        />
        <button type="submit" className="cr__chat-send" aria-label={t('meetingRoom.send')} disabled={!text.trim()}>
          <SendHorizontal width={20} height={20} />
        </button>
      </form>
    </aside>
  );
}
