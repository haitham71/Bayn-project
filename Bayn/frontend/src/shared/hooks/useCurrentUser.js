import { useTranslation } from 'react-i18next';
import { useProfile } from './useProfile';

// Display-name helper over the cached profile. Pages that only need the name
// (e.g. for <Navbar userName={...} />) can destructure fullName, or firstName
// for a greeting — both follow the active UI language.
export function useCurrentUser() {
  const { i18n } = useTranslation();
  const { data: user } = useProfile();

  const isArabic = i18n.language?.startsWith('ar');
  const first = user ? (isArabic ? user.first_name_ar : user.first_name_en) : '';
  const last = user ? (isArabic ? user.last_name_ar : user.last_name_en) : '';
  const firstName = first || (user ? user.first_name_en : '') || '';
  const fullName = [first || user?.first_name_en, last || user?.last_name_en].filter(Boolean).join(' ');

  return { user, firstName, fullName };
}
