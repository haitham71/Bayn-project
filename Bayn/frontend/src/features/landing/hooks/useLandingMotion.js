import { useEffect } from 'react';

// Page-wide entrance choreography, driven straight off the DOM rather than
// state: the header shadow on scroll, the `.reveal` fade-ins, and the connector
// line under the step row. Classes are added imperatively, so any component
// inside must avoid re-rendering a className that the observer has touched.
export function useLandingMotion(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    // Themed page scrollbar while the landing is showing.
    document.documentElement.classList.add('bayn-scroll');

    const hdr = root.querySelector('#lp-hdr');
    const onScroll = () => hdr && hdr.classList.toggle('scrolled', window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const reveals = root.querySelectorAll('.reveal');
    // Watched alongside the reveals so the connector line starts drawing as the
    // step row enters; the steps time their own entrance against it in CSS.
    const steps = root.querySelector('.steps');
    let io;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
      reveals.forEach((el, i) => {
        if (!el.classList.contains('step')) el.style.transitionDelay = `${Math.min(i % 3, 3) * 70}ms`;
        io.observe(el);
      });
      if (steps) io.observe(steps);
    } else {
      reveals.forEach((el) => el.classList.add('in'));
      if (steps) steps.classList.add('in');
    }

    return () => {
      document.documentElement.classList.remove('bayn-scroll');
      window.removeEventListener('scroll', onScroll);
      if (io) io.disconnect();
    };
  }, [rootRef]);
}
