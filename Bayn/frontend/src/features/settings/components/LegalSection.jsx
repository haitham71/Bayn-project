import { useTranslation } from 'react-i18next';
import ChevronRight from '@/assets/icons/chevron-right.svg?react';
import './LegalSection.css';

// Legal links: privacy policy + user agreement (open in a new tab).
export default function LegalSection() {
  const { t } = useTranslation();

  return (
    <section id="settings-legal" className="st__panel">
      <div className="st__panel-head">
        <h3>{t('settings.legalTitle')}</h3>
        <p className="st__panel-desc">{t('settings.legalDesc')}</p>
      </div>
      <a className="st__legal-row" href="/privacy-policy" target="_blank" rel="noreferrer">
        <span className="st__legal-name">{t('settings.privacyPolicy')}</span>
        <ChevronRight className="st__legal-arrow" width={18} height={18} aria-hidden="true" />
      </a>
      <a className="st__legal-row" href="/user-agreement" target="_blank" rel="noreferrer">
        <span className="st__legal-name">{t('settings.userAgreement')}</span>
        <ChevronRight className="st__legal-arrow" width={18} height={18} aria-hidden="true" />
      </a>
    </section>
  );
}
