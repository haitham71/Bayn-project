import { useQuery } from '@tanstack/react-query';
import { getProfile } from '@/features/identity/services/authService';

// Shared key so any page can read — or invalidate — the same cached profile.
export const profileQueryKey = ['profile'];

// Single source of truth for the signed-in user's profile. TanStack Query
// dedupes concurrent callers and caches the result, so navigating between pages
// reuses one fetch instead of calling the API on every mount.
export function useProfile() {
  return useQuery({
    queryKey: profileQueryKey,
    queryFn: getProfile,
  });
}
