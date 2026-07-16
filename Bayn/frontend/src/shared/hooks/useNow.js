import { useState, useEffect } from 'react';

// Ticking clock for time-dependent UI. Without it a countdown sitting on screen
// would stay frozen until the user reloads — so a meeting's join button would
// never enable on its own.
export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
