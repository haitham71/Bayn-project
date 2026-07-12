import { useEffect, useState } from 'react';
import { getProfile } from '@/features/identity/services/authService';

// Fetches the signed-in user's profile once. Pages that only need the
// display name (e.g. for <Navbar userName={...} />) can destructure fullName.
export function useCurrentUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    getProfile().then(setUser).catch(() => {});
  }, []);

  const fullName = user ? [user.first_name_en, user.last_name_en].filter(Boolean).join(' ') : '';

  return { user, fullName };
}
