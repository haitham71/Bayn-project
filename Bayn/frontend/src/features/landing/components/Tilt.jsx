import { useRef } from 'react';

// Leans the hero panel towards the pointer. Everything here is written straight
// to the DOM: the reveal observer marks this element with `in` imperatively, so
// a re-render would rewrite className and drop that class, hiding the panel.
export default function Tilt({ className = '', children }) {
  const ref = useRef(null);

  const tilt = (e) => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = el.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width - 0.5;
    const y = (e.clientY - box.top) / box.height - 0.5;
    el.classList.remove('resting');
    el.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${(y * -11).toFixed(2)}deg`);
  };

  const flatten = () => {
    const el = ref.current;
    if (!el) return;
    el.classList.add('resting');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--rx', '0deg');
  };

  return (
    <div
      ref={ref}
      className={`tilt resting ${className}`.trim()}
      onMouseMove={tilt}
      onMouseLeave={flatten}
    >
      {children}
    </div>
  );
}
