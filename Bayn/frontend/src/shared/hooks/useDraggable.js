import { useCallback, useEffect, useRef, useState } from 'react';

const MARGIN = 8; // keep this much of a gap from the viewport edges

// Reads a saved position, ignoring anything malformed.
function readStored(key) {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    const p = raw ? JSON.parse(raw) : null;
    return typeof p?.left === 'number' && typeof p?.top === 'number' ? p : null;
  } catch {
    return null;
  }
}

// Makes a fixed-position element draggable by a handle. `ref` is the element to
// move; the returned `handleProps` go on whatever grabs it (a title bar, say).
// The element stays inside the viewport — while dragging and after a resize —
// and remembers where it was left when given a `storageKey`.
//
// Returns { style, dragging, handleProps, reset }. Spread `style` onto the
// element: it's null until the first drag, so the CSS-defined corner still wins.
export default function useDraggable(ref, { storageKey } = {}) {
  const [pos, setPos] = useState(() => readStored(storageKey));
  const [dragging, setDragging] = useState(false);
  // Where inside the element the pointer grabbed it.
  const grabRef = useRef({ x: 0, y: 0 });

  // Keeps a position inside the viewport given the element's current size.
  const clamp = useCallback((left, top) => {
    const el = ref.current;
    const w = el?.offsetWidth || 0;
    const h = el?.offsetHeight || 0;
    return {
      left: Math.max(MARGIN, Math.min(left, window.innerWidth - w - MARGIN)),
      top: Math.max(MARGIN, Math.min(top, window.innerHeight - h - MARGIN)),
    };
  }, [ref]);

  function onPointerDown(e) {
    // Left button / touch only, and never when grabbing a control in the handle.
    if (e.button !== 0 || e.target.closest('button, a, input, textarea')) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    grabRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    // Pin to the measured spot first so the jump from `bottom`/`inset-inline-end`
    // to left/top positioning is invisible.
    setPos({ left: rect.left, top: rect.top });
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  // Track the pointer on the window so a fast drag that outruns the handle
  // doesn't drop the element.
  useEffect(() => {
    if (!dragging) return undefined;
    function onMove(e) {
      setPos(clamp(e.clientX - grabRef.current.x, e.clientY - grabRef.current.y));
    }
    function onUp() {
      setDragging(false);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging, clamp]);

  // A shrinking window must not strand the element off screen.
  useEffect(() => {
    if (!pos) return undefined;
    function onResize() {
      setPos((p) => (p ? clamp(p.left, p.top) : p));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pos, clamp]);

  // Persist once the drag settles, so reopening keeps the chosen spot.
  useEffect(() => {
    if (!storageKey || !pos || dragging) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(pos));
    } catch {
      // Storage full or blocked — the position just won't survive a reload.
    }
  }, [storageKey, pos, dragging]);

  // A stored position was measured against the previous viewport; pull it back
  // in once the element has a size.
  useEffect(() => {
    setPos((p) => (p ? clamp(p.left, p.top) : p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    setPos(null);
    if (storageKey) {
      try {
        window.localStorage.removeItem(storageKey);
      } catch { /* nothing to clean up */ }
    }
  }, [storageKey]);

  return {
    dragging,
    reset,
    // Clearing right/bottom drops the CSS corner anchoring (including the
    // logical inset-inline-end, which resolves to one of them) so left/top win.
    style: pos ? { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' } : null,
    handleProps: { onPointerDown },
  };
}
