import { useEffect, useRef } from 'react';
import { buildShapes, toPath, SAMPLES, DURATION, clamp, easeIn, easeOut, easeInOut } from '../lib/logoMorph';
import './PageLoader.css';

// Full-height loader shown while a lazily-loaded page chunk downloads: seven
// arcs spin as a ring, settle, then morph into the Bayn wordmark and back.
// `onDark` recolours it (mark + caption) for dark surfaces like the call screen;
// `label` puts a line of text under the mark (e.g. "Connecting to the meeting…").
// `inline` drops the full-viewport height + background so it can center inside an
// existing container (e.g. the call stage) instead of owning the whole screen.
export default function PageLoader({ onDark = false, label = '', inline = false }) {
  const groupRef = useRef(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return undefined;

    const green = onDark ? '#F7F4EE' : '#0F3D2E';
    const tan = '#BCA98A';
    const shapes = buildShapes();

    const paths = shapes.map((shape) => {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('fill', shape.color === 'green' ? green : tan);
      group.appendChild(el);
      return el;
    });

    // Respect the OS setting: no spinning, just the finished wordmark.
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (still) {
      shapes.forEach((shape, i) => paths[i].setAttribute('d', toPath(shape.logo)));
      return () => paths.forEach((el) => el.remove());
    }

    let raf = 0;
    // Timed from mount, not from page load, so every appearance opens on the
    // spinning ring rather than dropping in halfway through the morph.
    let start = 0;
    // Skip re-writing a path whose morph progress hasn't moved since last frame.
    const lastT = shapes.map(() => -1);

    const frame = (now) => {
      if (!start) start = now;
      const tu = ((now - start) / 1000) % DURATION;

      // The ring coasts to a stop, holds while the wordmark is up, then takes
      // off again — 360° over the cycle so the loop is seamless.
      let rot;
      if (tu < 1.008) rot = -300 * (1 - easeOut(tu / 1.008));
      else if (tu < 3.32) rot = 0;
      else rot = 60 * easeIn((tu - 3.32) / 0.28);
      group.setAttribute('transform', `rotate(${rot.toFixed(2)} 240 160)`);

      for (let i = 0; i < shapes.length; i += 1) {
        const shape = shapes[i];
        // Each piece leaves the ring on its own beat and comes back together.
        const forward = easeInOut(clamp((tu - (1.05 + shape.rank * 0.09)) / 0.55));
        const back = easeInOut(clamp((tu - (2.95 + shape.rank * 0.03)) / 0.4));
        const t = clamp(forward - back);
        if (t === lastT[i]) continue;
        lastT[i] = t;

        const points = [];
        for (let j = 0; j < SAMPLES; j += 1) {
          const a = shape.arc[j];
          const b = shape.logo[j];
          points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
        paths[i].setAttribute('d', toPath(points));
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      paths.forEach((el) => el.remove());
    };
  }, [onDark]);

  return (
    <div
      className={`page-loader${onDark ? ' page-loader--dark' : ''}${inline ? ' page-loader--inline' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="page-loader__mark">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" width="100%" aria-hidden="true">
          <g ref={groupRef} />
        </svg>
      </div>
      {label && <p className="page-loader__label">{label}</p>}
    </div>
  );
}
