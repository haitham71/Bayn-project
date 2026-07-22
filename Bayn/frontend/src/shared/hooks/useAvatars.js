import { useEffect, useState } from 'react';
import { getUserProfile } from '@/features/identity/services/authService';

// Module-level cache so the same user's avatar is fetched once across cards.
const cache = new Map(); // userId -> avatar_url | null

// Given a list of user ids, resolves each one's avatar_url from the public
// profile endpoint. Returns a { [id]: avatar_url|null } map.
export function useAvatars(ids) {
  const [map, setMap] = useState({});
  const key = [...new Set((ids || []).filter(Boolean))].sort().join(',');

  useEffect(() => {
    const unique = key ? key.split(',') : [];
    if (!unique.length) return undefined;

    // Show anything already cached right away.
    const cached = {};
    unique.forEach((id) => { if (cache.has(id)) cached[id] = cache.get(id); });
    if (Object.keys(cached).length) setMap((m) => ({ ...m, ...cached }));

    const missing = unique.filter((id) => !cache.has(id));
    if (!missing.length) return undefined;

    let alive = true;
    Promise.all(
      missing.map((id) =>
        getUserProfile(id)
          .then((p) => { const url = p?.avatar_url || null; cache.set(id, url); return [id, url]; })
          .catch(() => { cache.set(id, null); return [id, null]; }),
      ),
    ).then((pairs) => {
      if (alive) setMap((m) => ({ ...m, ...Object.fromEntries(pairs) }));
    });

    return () => { alive = false; };
  }, [key]);

  return map;
}
