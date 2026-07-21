import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProfile } from '@/shared/hooks/useProfile';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import { useAccountSettings } from '../hooks/useAccountSettings';
import { usePasswordChange } from '../hooks/usePasswordChange';
import AccountSection from '../components/AccountSection';
import PasswordSection from '../components/PasswordSection';
import NotificationsSection from '../components/NotificationsSection';
import LegalSection from '../components/LegalSection';
import './SettingsPage.css';

const NAV_SECTIONS = [
  { key: 'account', labelKey: 'settings.navAccount' },
  { key: 'security', labelKey: 'settings.navSecurity' },
  { key: 'notifications', labelKey: 'settings.navNotifications' },
  { key: 'legal', labelKey: 'settings.navLegal' },
];

export default function SettingsPage({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';
  const { data: profile } = useProfile();

  const [activeSection, setActiveSection] = useState('account');
  const [confirmState, setConfirmState] = useState(null);
  const askConfirm = (message, onConfirm) => setConfirmState({ message, onConfirm });

  const account = useAccountSettings(askConfirm);
  const pw = usePasswordChange(askConfirm);

  function handleConfirm() {
    const action = confirmState?.onConfirm;
    setConfirmState(null);
    action?.();
  }

  function scrollTo(key) {
    setActiveSection(key);
    document.getElementById(`settings-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const memberSince = profile?.created_at
    ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(profile.created_at))
    : '';

  return (
    <div className="st bayn-scroll">
      <Sidebar activeKey="settings" onNavigate={onNavigate} />

      <div className="st__main">
        <Navbar userName={profile ? `${profile.first_name_en || ''} ${profile.last_name_en || ''}`.trim() : ''} />

        <div className="st__head">
          <div>
            <h1>{t('settings.title')}</h1>
            <p className="st__subtitle">{t('settings.subtitle')}</p>
          </div>
          {memberSince && (
            <p className="st__member-since">{t('profileView.memberSince')}: <span>{memberSince}</span></p>
          )}
        </div>

        <div className="st__body">
          <nav className="st__nav" aria-label={t('settings.title')}>
            {NAV_SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`st__nav-item${activeSection === s.key ? ' st__nav-item--active' : ''}`}
                onClick={() => scrollTo(s.key)}
              >
                {t(s.labelKey)}
              </button>
            ))}
          </nav>

          <div className="st__content">
            <AccountSection account={account} />
            <PasswordSection pw={pw} />
            <NotificationsSection />
            <LegalSection />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={t('myProfile.confirmTitle')}
        message={confirmState?.message}
        confirmLabel={t('myProfile.confirmYes')}
        cancelLabel={t('myProfile.confirmCancel')}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
