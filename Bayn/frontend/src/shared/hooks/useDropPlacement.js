import { useLayoutEffect, useState } from 'react';

const GAP = 8; // breathing room between the menu and the viewport edge

// Keeps a dropdown menu on screen: prefers dropping below the field, flips above
// it when the menu wants more room than it has below (and there's more above),
// and caps the scrolling list so it never sits flush against the page edge.
//
// `fieldRef` anchors the measurement (the element the menu hangs off) and
// `listRef` is the scrolling list, capped at `maxHeight`. Options: `panelRef`
// when the list sits inside a wrapper with extra chrome (e.g. a search box), and
// `deps` for anything that changes the menu's contents.
//
// Returns { up, listMax } — apply `up` as a modifier class and `listMax` as the
// list's inline max-height.
export default function useDropPlacement(open, fieldRef, listRef, maxHeight, options = {}) {
  const { panelRef, deps = [] } = options;
  const [drop, setDrop] = useState({ up: false, listMax: null });

  useLayoutEffect(() => {
    if (!open) return undefined;
    function place() {
      const field = fieldRef.current;
      const list = listRef.current;
      if (!field || !list) return;
      const rect = field.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - GAP;
      const spaceAbove = rect.top - GAP;
      // Height taken by anything wrapping the list (search box, borders).
      const panel = panelRef?.current;
      const chrome = panel ? panel.offsetHeight - list.offsetHeight : 0;
      // What the menu wants, capped at its design max — compare against that
      // rather than its current (already capped) height, so a list that only
      // just fits below still flips up when there's clearly more room above.
      const desired = chrome + Math.min(maxHeight, list.scrollHeight);
      const up = desired > spaceBelow && spaceAbove > spaceBelow;
      const room = (up ? spaceAbove : spaceBelow) - chrome;
      setDrop({ up, listMax: Math.max(120, Math.min(maxHeight, room)) });
    }
    place();
    // Capture phase so scrolling containers between the field and the window
    // reposition the menu too.
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, maxHeight, ...deps]);

  return drop;
}
