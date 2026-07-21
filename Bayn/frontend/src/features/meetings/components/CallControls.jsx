import { useTranslation } from 'react-i18next';
import { useDaily, useLocalSessionId, useAudioTrack, useVideoTrack, useScreenShare } from '@daily-co/daily-react';
import Mic from '@/assets/icons/mic.svg?react';
import MicOff from '@/assets/icons/mic-off.svg?react';
import VideoIcon from '@/assets/icons/video.svg?react';
import VideoOff from '@/assets/icons/video-off.svg?react';
import ScreenShare from '@/assets/icons/screen-share.svg?react';
import ScreenShareOff from '@/assets/icons/screen-share-off.svg?react';
import MessageSquareText from '@/assets/icons/message-square-text.svg?react';
import PhoneOff from '@/assets/icons/phone-off.svg?react';

// Bottom control bar: mic / camera / screen-share / chat toggles + leave.
export default function CallControls({ chatOpen, unread, onToggleChat, onRequestLeave }) {
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
