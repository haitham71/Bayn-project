import { useEffect, useState, useCallback } from 'react';
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
} from '@daily-co/daily-react';
import { getMeetingJoinLink } from '@/features/meetings/services/meetingService';
import ArrowLeft from '@/assets/icons/arrow-left.svg?react';
import Mic from '@/assets/icons/mic.svg?react';
import MicOff from '@/assets/icons/mic-off.svg?react';
import VideoIcon from '@/assets/icons/video.svg?react';
import VideoOff from '@/assets/icons/video-off.svg?react';
import PhoneOff from '@/assets/icons/phone-off.svg?react';
import UserRound from '@/assets/icons/user-round.svg?react';
import './MeetingRoomPage.css';

// One participant's video tile — shows their camera, or an avatar + name when
// the camera is off.
function Tile({ sessionId, isLocal }) {
  const { t } = useTranslation();
  const videoState = useVideoTrack(sessionId);
  const audioState = useAudioTrack(sessionId);
  const name = useParticipantProperty(sessionId, 'user_name') || t('meetingRoom.guest');

  return (
    <div className="cr__tile">
      {videoState.isOff ? (
        <div className="cr__tile-off">
          <span className="cr__avatar"><UserRound width={40} height={40} aria-hidden="true" /></span>
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

      <span className="cr__name">
        {name}{isLocal ? ` (${t('meetingRoom.you')})` : ''}
        {audioState.isOff && <MicOff width={14} height={14} aria-hidden="true" className="cr__name-mute" />}
      </span>
    </div>
  );
}

// Bottom control bar: mic / camera toggles + leave.
function Controls() {
  const { t } = useTranslation();
  const daily = useDaily();
  const localId = useLocalSessionId();
  const mic = useAudioTrack(localId);
  const cam = useVideoTrack(localId);

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
        className="cr__ctrl cr__ctrl--leave"
        onClick={() => daily?.leave()}
        aria-label={t('meetingRoom.leave')}
      >
        <PhoneOff width={22} height={22} />
      </button>
    </div>
  );
}

// Inner room (inside the DailyProvider): joins the preset room and renders the
// custom call UI.
function Room({ onLeave }) {
  const { t } = useTranslation();
  const daily = useDaily();
  const participantIds = useParticipantIds();
  const localId = useLocalSessionId();
  const [status, setStatus] = useState('connecting'); // connecting | joined | error

  useEffect(() => {
    if (!daily) return;
    // Guard against StrictMode's double-invoke: only join from the fresh state.
    if (daily.meetingState() === 'new') {
      daily.join().then(() => setStatus('joined')).catch(() => setStatus('error'));
    }
  }, [daily]);

  useDailyEvent('left-meeting', useCallback(() => onLeave(), [onLeave]));
  useDailyEvent('error', useCallback(() => setStatus('error'), []));

  return (
    <div className="cr">
      <header className="cr__bar">
        <button type="button" className="cr__back" onClick={() => (daily ? daily.leave() : onLeave())}>
          <ArrowLeft width={20} height={20} aria-hidden="true" />
          {t('meetingRoom.leave')}
        </button>
        <span className="cr__brand">Bayn</span>
      </header>

      <div className="cr__stage">
        {status !== 'joined' && (
          <p className={`cr__state${status === 'error' ? ' cr__state--error' : ''}`}>
            {status === 'error' ? t('meetingRoom.error') : t('meetingRoom.connecting')}
          </p>
        )}
        <div className="cr__grid" data-count={Math.min(participantIds.length, 4)}>
          {participantIds.map((sid) => (
            <Tile key={sid} sessionId={sid} isLocal={sid === localId} />
          ))}
        </div>
      </div>

      <Controls />
      {/* Renders the audio for every remote participant. */}
      <DailyAudio />
    </div>
  );
}

// The meeting happens inside the app with our own call UI. We fetch the
// personalised join URL (room + per-user token), hand it to DailyProvider
// (which owns the call object's lifecycle, StrictMode-safe), and join.
export default function MeetingRoomPage({ onNavigate }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMeetingJoinLink(id)
      .then((u) => { if (!cancelled) setUrl(u); })
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

  if (!url) {
    return (
      <div className="cr cr--center">
        <p className="cr__state">{t('meetingRoom.connecting')}</p>
      </div>
    );
  }

  return (
    <DailyProvider url={url}>
      <Room onLeave={() => onNavigate?.('meetings')} />
    </DailyProvider>
  );
}
