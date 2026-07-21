import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { uploadAvatar } from '@/features/identity/services/authService';
import { useProfile, profileQueryKey } from '@/shared/hooks/useProfile';
import { getApiErrorMessage } from '@/shared/lib/apiError';

// Avatar picker + upload: validate the picked image, stage it for a preview,
// and upload on confirm (writing the fresh profile into the shared cache).
export function useAvatarUpload() {
  const { t } = useTranslation();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  const fileInputRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  // A picked-but-not-yet-uploaded image: staged for preview until confirmed.
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState('');
  const avatarUrl = profile?.avatar_url || '';

  // Free the object URL when the preview changes or the page unmounts.
  useEffect(() => () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
  }, [pendingPreview]);

  // Validate the picked image (matching the backend's rules) then stage it for
  // a preview — the actual upload waits for the confirm button.
  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // let the same file be re-picked
    if (!file) return;
    setAvatarError('');

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError(t('myProfile.avatarTypeError'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(t('myProfile.avatarSizeError'));
      return;
    }

    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
  }

  function cancelAvatarUpload() {
    setPendingFile(null);
    setPendingPreview('');
    setAvatarError('');
  }

  // Uploads the confirmed image. The response is the fresh profile, so we write
  // it into the cache — every page reading ['profile'] shows it immediately.
  async function confirmAvatarUpload() {
    if (!pendingFile) return;
    setAvatarUploading(true);
    setAvatarError('');
    try {
      const updated = await uploadAvatar(pendingFile);
      queryClient.setQueryData(profileQueryKey, updated);
      cancelAvatarUpload();
    } catch (err) {
      setAvatarError(getApiErrorMessage(err, t('myProfile.avatarUploadError')));
    } finally {
      setAvatarUploading(false);
    }
  }

  return {
    fileInputRef,
    avatarUrl,
    avatarUploading,
    avatarError,
    pendingFile,
    pendingPreview,
    handleAvatarChange,
    cancelAvatarUpload,
    confirmAvatarUpload,
  };
}
