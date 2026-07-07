import { useCallback, useEffect, useState } from 'react';

// Simple seconds countdown used for the "resend code" timer.
// Returns the raw seconds left, a mm:ss string, a done flag and a reset().
export default function useCountdown(initial = 32) {
  const [remaining, setRemaining] = useState(initial);

  useEffect(() => {
    if (remaining <= 0) return undefined;
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const reset = useCallback((value = initial) => setRemaining(value), [initial]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const formatted = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return { remaining, formatted, isDone: remaining <= 0, reset };
}
