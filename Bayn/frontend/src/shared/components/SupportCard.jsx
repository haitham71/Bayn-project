import { useTranslation } from 'react-i18next';
import Mail from '@/assets/icons/mail.svg?react';
import Phone from '@/assets/icons/phone.svg?react';
import './SupportCard.css';

export const SUPPORT_EMAIL = 'support@beynsa.com';
export const SUPPORT_PHONE = '+966 59 679 1960';

// Contact card shown from a support button — email + phone rows. Positioning is
// left to the caller (wrap it and place it relative to the trigger).
export default function SupportCard({ className = '' }) {
  const { t } = useTranslation();
  return (
    <div className={`support-card ${className}`.trim()} role="dialog" aria-label={t('home.supportTitle')}>
      <p className="support-card__title">{t('home.supportTitle')}</p>
      <p className="support-card__hint">{t('home.supportHint')}</p>
      <a className="support-card__row" href={`mailto:${SUPPORT_EMAIL}`}>
        <span className="support-card__ico">
          <Mail width={18} height={18} aria-hidden="true" />
        </span>
        <span className="support-card__val" dir="ltr">{SUPPORT_EMAIL}</span>
      </a>
      <a className="support-card__row" href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}>
        <span className="support-card__ico">
          <Phone width={18} height={18} aria-hidden="true" />
        </span>
        <span className="support-card__val" dir="ltr">{SUPPORT_PHONE}</span>
      </a>
    </div>
  );
}
