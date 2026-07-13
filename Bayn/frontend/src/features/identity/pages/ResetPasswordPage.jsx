import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import IdentityLayout from '@/layouts/IdentityLayout';
import Button from '@/shared/components/Button';
import Input from '@/shared/components/Input';
import PasswordStrength from '@/shared/components/PasswordStrength';
import Eye from '@/assets/icons/eye.svg?react';
import EyeOff from '@/assets/icons/eye-off.svg?react';
import { resetPassword } from '../services/authService';
import { validatePassword } from '../utils/validation';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import './ResetPasswordPage.css';

// Step 2 of the reset flow: reached via the emailed link. The token proves
// identity; the user just picks a new password.
export default function ResetPasswordPage({ onNavigate }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const next = {};
    const pass = validatePassword(password);
    if (pass) next.password = pass;
    if (!pass && confirm !== password) next.confirm = 'mismatch';
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setLoading(true);
    setSubmitError('');
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, t('resetPassword.error')));
    } finally {
      setLoading(false);
    }
  }

  const eye = (shown) => (shown
    ? <Eye width={20} height={20} aria-hidden="true" />
    : <EyeOff width={20} height={20} aria-hidden="true" />);

  const fieldErrText = (key) => {
    if (!errors[key]) return '';
    return key === 'confirm' ? t('resetPassword.mismatch') : t(`signup.${errors[key]}`);
  };

  return (
    <IdentityLayout>
      <div className="rp">
        <h2 className="rp__title">{t('resetPassword.title')}</h2>

        {!token ? (
          <p className="rp__message rp__message--error">{t('resetPassword.invalidLink')}</p>
        ) : done ? (
          <>
            <p className="rp__message rp__message--success">{t('resetPassword.success')}</p>
            <Button variant="primary" size="lg" className="rp__submit" onClick={() => onNavigate('login')}>
              {t('resetPassword.goToLogin')}
            </Button>
          </>
        ) : (
          <form className="rp__form" onSubmit={handleSubmit} noValidate>
            <p className="rp__message">{t('resetPassword.prompt')}</p>

            <Input
              label={t('resetPassword.newPassword')}
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
              trailingIcon={eye(showPw)}
              onTrailingClick={() => setShowPw((v) => !v)}
              className="rp__input"
              error={!!errors.password}
              errorText={fieldErrText('password')}
            />

            <Input
              label={t('resetPassword.confirmPassword')}
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setErrors((p) => ({ ...p, confirm: undefined })); }}
              trailingIcon={eye(showConfirm)}
              onTrailingClick={() => setShowConfirm((v) => !v)}
              className="rp__input"
              error={!!errors.confirm}
              errorText={fieldErrText('confirm')}
            />

            <PasswordStrength password={password} />

            {submitError && <p className="rp__error">{submitError}</p>}

            <Button type="submit" variant="primary" size="lg" className="rp__submit" disabled={loading}>
              {loading ? t('resetPassword.saving') : t('resetPassword.submit')}
            </Button>
          </form>
        )}
      </div>
    </IdentityLayout>
  );
}
