import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './NotificationsSection.css';

// Notification preferences. UI-only for now — there's no backend endpoint yet,
// so the toggles keep local state and the panel notes they're not wired.
export default function NotificationsSection() {
  const { t } = useTranslation();

  const [notifJoinRequests, setNotifJoinRequests] = useState(true);
  const [notifMeetingReminders, setNotifMeetingReminders] = useState(true);
  const [notifContractUpdates, setNotifContractUpdates] = useState(true);
  const [notifChatMessages, setNotifChatMessages] = useState(false);

  const rows = [
    { label: t('settings.notifJoinRequests'), sub: t('settings.notifJoinRequestsSub'), val: notifJoinRequests, set: setNotifJoinRequests },
    { label: t('settings.notifMeetings'), sub: t('settings.notifMeetingsSub'), val: notifMeetingReminders, set: setNotifMeetingReminders },
    { label: t('settings.notifContracts'), sub: t('settings.notifContractsSub'), val: notifContractUpdates, set: setNotifContractUpdates },
    { label: t('settings.notifChat'), sub: t('settings.notifChatSub'), val: notifChatMessages, set: setNotifChatMessages },
  ];

  return (
    <section id="settings-notifications" className="st__panel">
      <div className="st__panel-head">
        <h3>{t('settings.notifTitle')}</h3>
        <p className="st__panel-desc">{t('settings.notifDesc')}</p>
      </div>
      {rows.map((n) => (
        <div className="st__toggle-row" key={n.label}>
          <div>
            <p className="st__toggle-label">{n.label}</p>
            <p className="st__toggle-sub">{n.sub}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={n.val}
            className={`st__toggle${n.val ? ' st__toggle--on' : ''}`}
            onClick={() => n.set((v) => !v)}
          >
            <span className="st__toggle-knob" />
          </button>
        </div>
      ))}
      <p className="st__hint">{t('settings.notifNotWired')}</p>
    </section>
  );
}
