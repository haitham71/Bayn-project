import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DailyProvider,
  DailyVideo,
  DailyAudio,
  useDaily,
  useDailyEvent,
  useParticipantIds,
  useLocalSessionId,
  useVideoTrack,
  useAudioTrack,
  useParticipantProperty,
  useScreenShare,
  useAppMessage,
} from '@daily-co/daily-react';
import { getMeetingJoinLink } from '@/features/meetings/services/meetingService';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import ArrowLeft from '@/assets/icons/arrow-left.svg?react';
import Mic from '@/assets/icons/mic.svg?react';
import MicOff from '@/assets/icons/mic-off.svg?react';
import VideoIcon from '@/assets/icons/video.svg?react';
import VideoOff from '@/assets/icons/video-off.svg?react';
import ScreenShare from '@/assets/icons/screen-share.svg?react';
import ScreenShareOff from '@/assets/icons/screen-share-off.svg?react';
import PhoneOff from '@/assets/icons/phone-off.svg?react';
import UserRound from '@/assets/icons/user-round.svg?react';
import UserX from '@/assets/icons/user-x.svg?react';
import MessageSquareText from '@/assets/icons/message-square-text.svg?react';
import SendHorizontal from '@/assets/icons/send-horizontal.svg?react';
import X from '@/assets/icons/x.svg?react';
import Clock from '@/assets/icons/clock.svg?react';
import Maximize from '@/assets/icons/maximize.svg?react';
import Minimize from '@/assets/icons/minimize.svg?react';
import logoUrl from '@/assets/logo/Bayn-svg.svg?url';
import BaynLogo from '@/assets/logo/Bayn-svg.svg?react';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import './MeetingRoomPage.css';

// Ask the camera for 720p — Daily's default capture is low-res (~360p), which
// is what made the video look soft.
const CAMERA_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 },
};

// Milliseconds -> "M:SS" (or "H:MM:SS" past an hour) for the countdown.
function formatRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// One participant's video tile — shows their camera, or an avatar + name when
// the camera is off. When the local user is the host, remote tiles expose
// moderator actions (force-mute, remove).
function Tile({ sessionId, isLocal, isHost }) {
  const { t } = useTranslation();
  const daily = useDaily();
  const videoState = useVideoTrack(sessionId);
  const audioState = useAudioTrack(sessionId);
  const name = useParticipantProperty(sessionId, 'user_name') || t('meetingRoom.guest');
  // The backend puts the user's avatar URL in the Daily token's user_data.
  const userData = useParticipantProperty(sessionId, 'userData');
  const avatar = typeof userData === 'string' ? userData : userData?.avatar || '';
  const canModerate = isHost && !isLocal;

  return (
    <div className="cr__tile">
      {videoState.isOff ? (
        <div className="cr__tile-off">
          {avatar ? (
            <img src={avatar} alt="" className="cr__avatar-img" />
          ) : (
            <span className="cr__avatar"><UserRound width={40} height={40} aria-hidden="true" /></span>
          )}
        </div>
      ) : (
        <DailyVideo
          sessionId={sessionId}
          type="video"
          automirror={isLocal}
          fit="cover"
          className="cr__video"
        />
      )}

      {canModerate && (
        <div className="cr__mod">
          <button
            type="button"
            className="cr__mod-btn"
            onClick={() => daily?.updateParticipant(sessionId, { setAudio: false })}
            disabled={audioState.isOff}
            aria-label={t('meetingRoom.muteParticipant')}
            title={t('meetingRoom.muteParticipant')}
          >
            <MicOff width={16} height={16} />
          </button>
          <button
            type="button"
            className="cr__mod-btn cr__mod-btn--remove"
            onClick={() => daily?.updateParticipant(sessionId, { eject: true })}
            aria-label={t('meetingRoom.removeParticipant')}
            title={t('meetingRoom.removeParticipant')}
          >
            <UserX width={16} height={16} />
          </button>
        </div>
      )}

      <span className="cr__name">
        {name}{isLocal ? ` (${t('meetingRoom.you')})` : ''}
        {audioState.isOff && <MicOff width={14} height={14} aria-hidden="true" className="cr__name-mute" />}
      </span>
    </div>
  );
}

// Bottom control bar: mic / camera / screen-share / chat toggles + leave.
function Controls({ chatOpen, unread, onToggleChat, onRequestLeave }) {
  const { t } = useTranslation();
  const daily = useDaily();
  const localId = useLocalSessionId();
  const mic = useAudioTrack(localId);
  const cam = useVideoTrack(localId);
  const { isSharingScreen, startScreenShare, stopScreenShare } = useScreenShare();

  return (
    <div className="cr__controls">
      <button
        type="button"
        className={`cr__ctrl${mic.isOff ? ' cr__ctrl--off' : ''}`}
        onClick={() => daily?.setLocalAudio(mic.isOff)}
        aria-label={t(mic.isOff ? 'meetingRoom.unmute' : 'meetingRoom.mute')}
      >
        {mic.isOff ? <MicOff width={22} height={22} /> : <Mic width={22} height={22} />}
      </button>

      <button
        type="button"
        className={`cr__ctrl${cam.isOff ? ' cr__ctrl--off' : ''}`}
        onClick={() => daily?.setLocalVideo(cam.isOff)}
        aria-label={t(cam.isOff ? 'meetingRoom.cameraOn' : 'meetingRoom.cameraOff')}
      >
        {cam.isOff ? <VideoOff width={22} height={22} /> : <VideoIcon width={22} height={22} />}
      </button>

      <button
        type="button"
        className={`cr__ctrl${isSharingScreen ? ' cr__ctrl--active' : ''}`}
        onClick={() => (isSharingScreen ? stopScreenShare() : startScreenShare())}
        aria-label={t(isSharingScreen ? 'meetingRoom.stopShare' : 'meetingRoom.share')}
      >
        {isSharingScreen ? <ScreenShareOff width={22} height={22} /> : <ScreenShare width={22} height={22} />}
      </button>

      <button
        type="button"
        className={`cr__ctrl${chatOpen ? ' cr__ctrl--active' : ''}`}
        onClick={onToggleChat}
        aria-label={t('meetingRoom.chat')}
      >
        <MessageSquareText width={22} height={22} />
        {unread > 0 && !chatOpen && <span className="cr__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      <button
        type="button"
        className="cr__ctrl cr__ctrl--leave"
        onClick={onRequestLeave}
        aria-label={t('meetingRoom.leave')}
      >
        <PhoneOff width={22} height={22} />
      </button>
    </div>
  );
}

// Right-hand chat panel — live, in-call messages over Daily's data channel.
function ChatPanel({ open, messages, onSend, onClose }) {
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

// Inner room (inside the DailyProvider): joins the preset room and renders the
// custom call UI.
function Room({ onLeave, endsAt }) {
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
          {status !== 'joined' && (
            <p className={`cr__state${status === 'error' ? ' cr__state--error' : ''}`}>
              {status === 'error' ? t('meetingRoom.error') : t('meetingRoom.connecting')}
            </p>
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
              <Tile key={sid} sessionId={sid} isLocal={sid === localId} isHost={isHost} />
            ))}
          </div>
        </div>

        <ChatPanel
          open={chatOpen}
          messages={messages}
          onSend={handleSend}
          onClose={() => setChatOpen(false)}
        />
      </div>

      <Controls
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

// The meeting happens inside the app with our own call UI. We fetch the
// personalised join URL (room + per-user token), hand it to DailyProvider
// (which owns the call object's lifecycle, StrictMode-safe), and join.
export default function MeetingRoomPage({ onNavigate }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const [join, setJoin] = useState(null); // { url, ends_at }
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMeetingJoinLink(id)
      .then((data) => { if (!cancelled) setJoin(data); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [id]);

  if (failed) {
    return (
      <div className="cr cr--center">
        <p className="cr__state cr__state--error">{t('meetingRoom.error')}</p>
        <button type="button" className="cr__back" onClick={() => onNavigate?.('meetings')}>
          <ArrowLeft width={20} height={20} aria-hidden="true" />
          {t('meetingRoom.leave')}
        </button>
      </div>
    );
  }

  if (!join) {
    return (
      <div className="cr cr--center">
        <p className="cr__state">{t('meetingRoom.connecting')}</p>
      </div>
    );
  }

  // The backend returns "<room>?t=<token>". In call-object mode the token in the
  // query string isn't applied automatically (unlike Prebuilt), so split it out
  // and hand it to Daily explicitly — otherwise everyone joins as "Guest".
  const parsed = new URL(join.url);
  const token = parsed.searchParams.get('t') || undefined;
  const roomUrl = parsed.origin + parsed.pathname;

  return (
    <DailyProvider
      url={roomUrl}
      token={token}
      dailyConfig={{ userMediaVideoConstraints: CAMERA_CONSTRAINTS }}
    >
      <Room onLeave={() => onNavigate?.('meetings')} endsAt={join.ends_at} />
    </DailyProvider>
  );
}
