import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getProfile } from '@/features/identity/services/authService';

// Fetches the signed-in user's profile once. Pages that only need the
// display name (e.g. for <Navbar userName={...} />) can destructure fullName,
// or firstName for a greeting — both follow the active UI language.
export function useCurrentUser() {
  const { i18n } = useTranslation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    getProfile().then(setUser).catch(() => {});
  }, []);

  const isArabic = i18n.language?.startsWith('ar');
  const first = user ? (isArabic ? user.first_name_ar : user.first_name_en) : '';
  const last = user ? (isArabic ? user.last_name_ar : user.last_name_en) : '';
  const firstName = first || (user ? user.first_name_en : '') || '';
  const fullName = [first || user?.first_name_en, last || user?.last_name_en].filter(Boolean).join(' ');

  return { user, firstName, fullName };
}
