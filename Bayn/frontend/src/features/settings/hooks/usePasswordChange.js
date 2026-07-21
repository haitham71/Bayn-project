import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { requestPasswordChange as requestPasswordChangeApi } from '@/features/identity/services/authService';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import { validatePassword } from '@/features/identity/utils/validation';

// Logged-in password change: validate, confirm, then email a change link.
// Saving routes through the shared confirm dialog via `askConfirm`.
export function usePasswordChange(askConfirm) {
  const { t } = useTranslation();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwErrors, setPwErrors] = useState({});
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSubmitError, setPwSubmitError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  async function doPasswordSave() {
    setPwSaving(true);
    setPwSubmitError('');
    try {
      await requestPasswordChangeApi(currentPassword, newPassword);
      setPwSuccess(t('myProfile.passwordEmailSent'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (e) {
      setPwSubmitError(getApiErrorMessage(e, t('signup.errorGeneric')));
    } finally {
      setPwSaving(false);
    }
  }

  function requestPasswordSave() {
    const next = {};
    if (!currentPassword) next.current = 'errRequired';
    const pass = validatePassword(newPassword);
    if (pass) next.new = pass;
    else if (newPassword === currentPassword) next.new = 'errSamePassword';
    if (!next.new && confirmNewPassword !== newPassword) next.confirm = 'errorPassword';
    setPwErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setPwSubmitError('');
    setPwSuccess('');
    askConfirm(t('myProfile.confirmPasswordMsg'), doPasswordSave);
  }

  function clearPwError(field) {
    setPwErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }
  const pwFieldError = (field) =>
    pwErrors[field] ? { error: true, errorText: t(`signup.${pwErrors[field]}`) } : {};

  return {
    currentPassword, setCurrentPassword,
    newPassword, setNewPassword,
    confirmNewPassword, setConfirmNewPassword,
    showCurrent, setShowCurrent, showNew, setShowNew, showConfirm, setShowConfirm,
    pwSaving, pwSubmitError, pwSuccess,
    requestPasswordSave, clearPwError, pwFieldError,
  };
}
