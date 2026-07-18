import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DailyIframe from '@daily-co/daily-js';
import { getMeetingJoinLink } from '@/features/meetings/services/meetingService';
import ArrowLeft from '@/assets/icons/arrow-left.svg?react';
import './MeetingRoomPage.css';

// Daily Prebuilt theme in Bayn's palette, so the embedded call matches the app.
const THEME = {
  colors: {
    accent: '#295E4D',
    accentText: '#FFFFFF',
    background: '#EBE5DC',
    backgroundAccent: '#D7CBB9',
    baseText: '#0F3D2E',
    border: '#D7CBB9',
    mainAreaBg: '#0F3D2E',
    mainAreaBgAccent: '#295E4D',
    mainAreaText: '#FFFFFF',
    supportiveText: '#786C57',
  },
};

// The meeting happens inside the app now: we embed Daily Prebuilt in an iframe
// instead of opening the room in a new tab. The personalised join URL (room +
// per-user token) is fetched on mount and the frame joins it.
export default function MeetingRoomPage({ onNavigate }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const holderRef = useRef(null);
  const frameRef = useRef(null);
  const [status, setStatus] = useState('connecting'); // connecting | joined | error

  useEffect(() => {
    if (frameRef.current || !holderRef.current) return undefined;

    const frame = DailyIframe.createFrame(holderRef.current, {
      showLeaveButton: true,
      showFullscreenButton: true,
      iframeStyle: { width: '100%', height: '100%', border: '0' },
      theme: THEME,
    });
    frameRef.current = frame;

    const goBack = () => onNavigate?.('meetings');
    frame.on('left-meeting', goBack);

    let cancelled = false;
    (async () => {
      try {
        const url = await getMeetingJoinLink(id);
        if (cancelled) return;
        await frame.join({ url });
        if (!cancelled) setStatus('joined');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      frame.off('left-meeting', goBack);
      frame.destroy();
      frameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="mr">
      <header className="mr__bar">
        <button type="button" className="mr__back" onClick={() => onNavigate?.('meetings')}>
          <ArrowLeft width={20} height={20} aria-hidden="true" />
          {t('meetingRoom.leave')}
        </button>
        <span className="mr__brand">Bayn</span>
      </header>

      <div className="mr__stage">
        <div ref={holderRef} className="mr__frame" />
        {status !== 'joined' && (
          <p className={`mr__state${status === 'error' ? ' mr__state--error' : ''}`}>
            {status === 'error' ? t('meetingRoom.error') : t('meetingRoom.connecting')}
          </p>
        )}
      </div>
    </div>
  );
}
