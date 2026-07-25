import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DailyVideo,
  DailyAudio,
  useDaily,
  useDailyEvent,
  useParticipantIds,
  useLocalSessionId,
  useParticipantProperty,
  useScreenShare,
  useAppMessage,
} from '@daily-co/daily-react';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import ArrowLeft from '@/assets/icons/arrow-left.svg?react';
import Clock from '@/assets/icons/clock.svg?react';
import Maximize from '@/assets/icons/maximize.svg?react';
import Minimize from '@/assets/icons/minimize.svg?react';
import logoUrl from '@/assets/logo/Bayn-svg.svg?url';
import BaynLogo from '@/assets/logo/Bayn-svg.svg?react';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import PageLoader from '@/shared/components/PageLoader';
import { formatRemaining } from '../lib/callFormat';
import CallTile from './CallTile';
import CallControls from './CallControls';
import CallChatPanel from './CallChatPanel';

// Inner room (inside the DailyProvider): joins the preset room and renders the
// custom call UI.
export default function CallRoom({ onLeave, endsAt }) {
  const { t } = useTranslation();
  const daily = useDaily();
  const participantIds = useParticipantIds();
  const localId = useLocalSessionId();
  const { screens } = useScreenShare();
  // The project owner joins with a Daily owner token (see backend), which is
  // what unlocks the moderator actions below.
  const isHost = Boolean(useParticipantProperty(localId, 'owner'));
  const localName = useParticipantProperty(localId, 'user_name');
  const { user } = useCurrentUser();
  const [status, setStatus] = useState('connecting'); // connecting | joined | error | ended
  // Set when we end the call ourselves at the scheduled time, so the auto
  // 'left-meeting' doesn't bounce the user away before they see the notice.
  const endedRef = useRef(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);

  // ── Live chat (Daily data channel, not persisted) ──
  const [messages, setMessages] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const chatOpenRef = useRef(false);
  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) setUnread(0);
  }, [chatOpen]);

  const sendAppMessage = useAppMessage({
    onAppMessage: useCallback(
      (ev) => {
        const sender = daily?.participants?.()[ev.fromId];
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), name: sender?.user_name || '', text: String(ev.data?.text || ''), local: false },
        ]);
        if (!chatOpenRef.current) setUnread((u) => u + 1);
      },
      [daily],
    ),
  });

  const handleSend = useCallback(
    (text) => {
      sendAppMessage({ text }, '*');
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), name: localName || '', text, local: true }]);
    },
    [sendAppMessage, localName],
  );

  // Daily meeting tokens can't carry arbitrary data, so we broadcast our own
  // avatar URL via setUserData once joined; peers read it off their participant.
  useEffect(() => {
    if (status === 'joined' && daily && user?.avatar_url) {
      daily.setUserData({ avatar: user.avatar_url });
    }
  }, [status, daily, user?.avatar_url]);

  useEffect(() => {
    if (!daily) return;
    // Guard against StrictMode's double-invoke: only join from the fresh state.
    if (daily.meetingState() === 'new') {
      daily
        .join()
        .then(() => {
          setStatus('joined');
          // Prefer a sharp stream now that we're in.
          daily.updateSendSettings({ video: { maxQuality: 'high' } }).catch(() => {});
        })
        .catch(() => setStatus('error'));
    }
  }, [daily]);

  // Fullscreen for the shared screen: request it on the screens wrapper so the
  // shared content fills the whole display.
  const screensRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === screensRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else screensRef.current?.requestFullscreen?.();
  }, []);

  // Live countdown to the scheduled end, ticking once a second.
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (status !== 'joined' || !endsAt) return undefined;
    const tick = () => setRemaining(new Date(endsAt).getTime() - Date.now());
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [status, endsAt]);

  // Close the call for this client when the scheduled end time arrives. Daily
  // also expires the room server-side at the same moment (backend), so the
  // meeting ends for everyone; this just makes it graceful.
  useEffect(() => {
    if (status !== 'joined' || !endsAt) return undefined;
    const end = () => {
      endedRef.current = true;
      setStatus('ended');
      daily?.leave();
    };
    const ms = new Date(endsAt).getTime() - Date.now();
    if (ms <= 0) { end(); return undefined; }
    const timer = setTimeout(end, ms);
    return () => clearTimeout(timer);
  }, [status, endsAt, daily]);

  // Leaving navigates back — unless we ended on schedule, where we hold on the
  // "meeting ended" notice instead.
  useDailyEvent('left-meeting', useCallback(() => {
    if (!endedRef.current) onLeave();
  }, [onLeave]));
  useDailyEvent('error', useCallback(() => setStatus('error'), []));

  const requestLeave = useCallback(() => setConfirmLeaveOpen(true), []);
  const doLeave = useCallback(() => {
    setConfirmLeaveOpen(false);
    if (daily) daily.leave(); else onLeave();
  }, [daily, onLeave]);

  if (status === 'ended') {
    return (
      <div className="cr cr--center">
        <BaynLogo className="cr__logo-mark" aria-hidden="true" />
        <p className="cr__state">{t('meetingRoom.ended')}</p>
        <button type="button" className="cr__back cr__back--light" onClick={onLeave}>
          <ArrowLeft width={20} height={20} aria-hidden="true" />
          {t('meetingRoom.backToMeetings')}
        </button>
      </div>
    );
  }

  const sharing = screens.length > 0;

  return (
    <div className="cr">
      <header className="cr__bar">
        <button type="button" className="cr__back" onClick={requestLeave}>
          <ArrowLeft width={20} height={20} aria-hidden="true" />
          {t('meetingRoom.leave')}
        </button>
        {remaining != null && (
          <span
            className={`cr__timer${remaining <= 60000 ? ' cr__timer--low' : ''}`}
            title={t('meetingRoom.timeLeft')}
          >
            <Clock width={16} height={16} aria-hidden="true" />
            {formatRemaining(remaining)}
          </span>
        )}
        <img src={logoUrl} alt="Bayn" className="cr__logo" />
      </header>

      <div className="cr__body">
        <div className={`cr__stage${sharing ? ' cr__stage--sharing' : ''}`}>
          {status === 'error' && (
            <p className="cr__state cr__state--error">{t('meetingRoom.error')}</p>
          )}
          {status === 'connecting' && (
            <div className="cr__state">
              <PageLoader onDark inline label={t('meetingRoom.connecting')} />
            </div>
          )}

          {sharing && (
            <div className="cr__screens" ref={screensRef}>
              {screens.map((s) => (
                <DailyVideo
                  key={s.screenId}
                  sessionId={s.session_id}
                  type="screenVideo"
                  fit="contain"
                  className="cr__screen-video"
                />
              ))}
              <button
                type="button"
                className="cr__fs-btn"
                onClick={toggleFullscreen}
                aria-label={t(isFullscreen ? 'meetingRoom.exitFullscreen' : 'meetingRoom.fullscreen')}
                title={t(isFullscreen ? 'meetingRoom.exitFullscreen' : 'meetingRoom.fullscreen')}
              >
                {isFullscreen ? <Minimize width={20} height={20} /> : <Maximize width={20} height={20} />}
              </button>
            </div>
          )}

          <div className="cr__grid" data-count={Math.min(participantIds.length, 4)}>
            {participantIds.map((sid) => (
              <CallTile key={sid} sessionId={sid} isLocal={sid === localId} isHost={isHost} />
            ))}
          </div>
        </div>

        <CallChatPanel
          open={chatOpen}
          messages={messages}
          onSend={handleSend}
          onClose={() => setChatOpen(false)}
        />
      </div>

      <CallControls
        chatOpen={chatOpen}
        unread={unread}
        onToggleChat={() => setChatOpen((o) => !o)}
        onRequestLeave={requestLeave}
      />
      {/* Renders the audio for every remote participant. */}
      <DailyAudio />

      <ConfirmDialog
        open={confirmLeaveOpen}
        title={t('meetingRoom.confirmLeaveTitle')}
        message={t('meetingRoom.confirmLeaveMsg')}
        confirmLabel={t('meetingRoom.leave')}
        cancelLabel={t('meetingRoom.stay')}
        onConfirm={doLeave}
        onCancel={() => setConfirmLeaveOpen(false)}
      />
    </div>
  );
}
