import { useEffect, useRef } from 'react';

// Polls `fetch` on an interval, but only while the tab is actually being looked
// at. Users leave the app open in a background tab for hours, and a badge they
// can't see is not worth a request every few seconds. Coming back to the tab
// refreshes immediately, so the badge is current by the time it's on screen.
export function useVisiblePoll(fetch, intervalMs) {
  // Keep the latest callback without restarting the timer on every render.
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;

  useEffect(() => {
    const run = () => { if (!document.hidden) fetchRef.current(); };

    run();
    const id = setInterval(run, intervalMs);
    document.addEventListener('visibilitychange', run);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', run);
    };
  }, [intervalMs]);
}
