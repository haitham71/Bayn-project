import { useTranslation } from 'react-i18next';
import {
  DailyVideo,
  useDaily,
  useVideoTrack,
  useAudioTrack,
  useParticipantProperty,
} from '@daily-co/daily-react';
import UserRound from '@/assets/icons/user-round.svg?react';
import MicOff from '@/assets/icons/mic-off.svg?react';
import UserX from '@/assets/icons/user-x.svg?react';

// One participant's video tile — shows their camera, or an avatar + name when
// the camera is off. When the local user is the host, remote tiles expose
// moderator actions (force-mute, remove).
export default function CallTile({ sessionId, isLocal, isHost }) {
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
