import { useTranslation } from 'react-i18next';
import { LegalLink } from '@/features/legal/components/LegalLink';
import ChevronRight from '@/assets/icons/chevron-right.svg?react';
import './LegalSection.css';

// Legal links: privacy policy + user agreement. They open in-app carrying the
// settings page as their origin, so the legal page's breadcrumb points back
// here (ctrl/cmd-click still opens a new tab via the real href).
const FROM_SETTINGS = { label: 'الإعدادات', to: '/settings' };

export default function LegalSection() {
  const { t } = useTranslation();

  return (
    <section id="settings-legal" className="st__panel">
      <div className="st__panel-head">
        <h3>{t('settings.legalTitle')}</h3>
        <p className="st__panel-desc">{t('settings.legalDesc')}</p>
      </div>
      <LegalLink to="/privacy" fromCrumb={FROM_SETTINGS} className="st__legal-row">
        <span className="st__legal-name">{t('settings.privacyPolicy')}</span>
        <ChevronRight className="st__legal-arrow" width={18} height={18} aria-hidden="true" />
      </LegalLink>
      <LegalLink to="/terms" fromCrumb={FROM_SETTINGS} className="st__legal-row">
        <span className="st__legal-name">{t('settings.userAgreement')}</span>
        <ChevronRight className="st__legal-arrow" width={18} height={18} aria-hidden="true" />
      </LegalLink>
    </section>
  );
}
