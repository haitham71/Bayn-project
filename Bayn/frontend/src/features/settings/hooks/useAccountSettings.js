import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { updateProfile } from '@/features/identity/services/authService';
import { useProfile, profileQueryKey } from '@/shared/hooks/useProfile';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import { validateUsername } from '@/features/identity/utils/validation';

// Account info: username is editable; email/phone are shown read-only. Saving
// routes through the shared confirm dialog via `askConfirm(message, action)`.
export function useAccountSettings(askConfirm) {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [accountErrors, setAccountErrors] = useState({});
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');

  // Seed the fields from the cached profile once it loads.
  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username || '');
    setEmail(profile.email || '');
    setPhone(profile.phone_number ? `+966 ${profile.phone_number}` : '');
  }, [profile]);

  function onUsernameChange(value) {
    setUsername(value);
    setAccountErrors((p) => (p.username ? {} : p));
    setAccountError('');
  }

  async function doAccountSave() {
    setAccountSaving(true);
    setAccountError('');
    try {
      const updated = await updateProfile({ username });
      queryClient.setQueryData(profileQueryKey, updated);
    } catch (e) {
      setAccountError(getApiErrorMessage(e, t('signup.errorGeneric')));
    } finally {
      setAccountSaving(false);
    }
  }

  function requestAccountSave() {
    const err = validateUsername(username);
    setAccountErrors(err ? { username: err } : {});
    if (err) return;
    if (username.trim() === (profile?.username || '')) {
      setAccountError(t('myProfile.noChanges'));
      return;
    }
    setAccountError('');
    askConfirm(t('myProfile.confirmAccountMsg'), doAccountSave);
  }

  const accountFieldError = (field) =>
    accountErrors[field] ? { error: true, errorText: t(`signup.${accountErrors[field]}`) } : {};

  return { username, email, phone, accountError, accountSaving, onUsernameChange, requestAccountSave, accountFieldError };
}
