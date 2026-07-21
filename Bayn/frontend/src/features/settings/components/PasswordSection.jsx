import { useTranslation } from 'react-i18next';
import Input from '@/shared/components/Input';
import Button from '@/shared/components/Button';
import PasswordStrength from '@/shared/components/PasswordStrength';
import Eye from '@/assets/icons/eye.svg?react';
import EyeOff from '@/assets/icons/eye-off.svg?react';

function eyeToggle(shown) {
  return shown
    ? <Eye width={18} height={18} aria-hidden="true" />
    : <EyeOff width={18} height={18} aria-hidden="true" />;
}

// Change-password panel — current + new + confirm, with a strength meter.
export default function PasswordSection({ pw }) {
  const { t } = useTranslation();

  return (
    <section id="settings-security" className="st__panel">
      <div className="st__panel-head">
        <h3>{t('myProfile.changePassword')}</h3>
        <p className="st__panel-desc">{t('settings.passwordDesc')}</p>
      </div>
      <div className="st__row2">
        <Input
          label={t('myProfile.currentPassword')} type={pw.showCurrent ? 'text' : 'password'}
          value={pw.currentPassword}
          onChange={(e) => { pw.setCurrentPassword(e.target.value); pw.clearPwError('current'); }}
          trailingIcon={eyeToggle(pw.showCurrent)} onTrailingClick={() => pw.setShowCurrent((s) => !s)}
          {...pw.pwFieldError('current')}
        />
        <Input
          label={t('myProfile.newPassword')} type={pw.showNew ? 'text' : 'password'}
          value={pw.newPassword}
          onChange={(e) => { pw.setNewPassword(e.target.value); pw.clearPwError('new'); }}
          trailingIcon={eyeToggle(pw.showNew)} onTrailingClick={() => pw.setShowNew((s) => !s)}
          {...pw.pwFieldError('new')}
        />
      </div>
      <div className="st__row2">
        <Input
          label={t('myProfile.confirmNewPassword')} type={pw.showConfirm ? 'text' : 'password'}
          value={pw.confirmNewPassword}
          onChange={(e) => { pw.setConfirmNewPassword(e.target.value); pw.clearPwError('confirm'); }}
          trailingIcon={eyeToggle(pw.showConfirm)} onTrailingClick={() => pw.setShowConfirm((s) => !s)}
          {...pw.pwFieldError('confirm')}
        />
      </div>
      <PasswordStrength password={pw.newPassword} />
      {pw.pwSubmitError && <p className="st__error">{pw.pwSubmitError}</p>}
      {pw.pwSuccess && <p className="st__hint">{pw.pwSuccess}</p>}
      <div className="st__save-row">
        <Button variant="primary" size="sm" onClick={pw.requestPasswordSave} disabled={pw.pwSaving}>
          {t('myProfile.changePassword')}
        </Button>
      </div>
    </section>
  );
}
