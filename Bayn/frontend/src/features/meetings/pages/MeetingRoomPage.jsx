import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DailyProvider } from '@daily-co/daily-react';
import { getMeetingJoinLink } from '@/features/meetings/services/meetingService';
import ArrowLeft from '@/assets/icons/arrow-left.svg?react';
import { CAMERA_CONSTRAINTS } from '../lib/callFormat';
import CallRoom from '../components/CallRoom';
import './MeetingRoomPage.css';

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
      <CallRoom onLeave={() => onNavigate?.('meetings')} endsAt={join.ends_at} />
    </DailyProvider>
  );
}
