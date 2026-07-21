import { useTranslation } from 'react-i18next';
import Input from '@/shared/components/Input';
import Button from '@/shared/components/Button';

// Account info: username (editable) + email/phone (read-only).
export default function AccountSection({ account }) {
  const { t } = useTranslation();

  return (
    <section id="settings-account" className="st__panel">
      <div className="st__panel-head">
        <h3>{t('settings.accountTitle')}</h3>
        <p className="st__panel-desc">{t('settings.accountDesc')}</p>
      </div>

      <div className="st__row2">
        <Input
          label={t('signup.username')}
          value={account.username}
          dir="ltr"
          onChange={(e) => account.onUsernameChange(e.target.value)}
          {...account.accountFieldError('username')}
        />
        <Input label={t('signup.email')} value={account.email} dir="ltr" disabled />
      </div>
      <div className="st__row2">
        <Input label={t('signup.phone')} value={account.phone} dir="ltr" disabled />
      </div>
      {account.accountError && <p className="st__error">{account.accountError}</p>}
      <div className="st__save-row">
        <Button variant="primary" size="sm" onClick={account.requestAccountSave} disabled={account.accountSaving}>
          {t('myProfile.save')}
        </Button>
      </div>
    </section>
  );
}
