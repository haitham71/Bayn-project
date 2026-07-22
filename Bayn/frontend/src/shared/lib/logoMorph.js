// Geometry behind the page loader: turns the seven Bayn wordmark pieces and the
// seven arcs of a ring into point lists of matching length, so one can be
// tweened into the other. Everything here is pure maths on a 480x320 canvas —
// the animation itself lives in PageLoader.

// Each wordmark piece with the colour it paints in and the angle (degrees) of
// the ring arc it collapses into.
const PIECES = [
  { angle: -26, color: 'green', d: 'M1704.7,125.93v547.82c0,0.17-0.01,0.35-0.02,0.53c-0.32,3.97-0.7,7.88-1.17,11.82c-8.7,72.6-44.56,138.06-98.45,188.32c-2.62,2.44-6.81,1.97-8.87-0.95l-159.71-225.25c-0.71-1-1.09-2.2-1.09-3.44V125.93c0-3.28,2.66-5.94,5.94-5.94h257.44C1702.04,119.99,1704.7,122.65,1704.7,125.93z' },
  { angle: 25.4, color: 'tan', d: 'M1572.52,901.36c-52.17,38.2-116.5,63.97-187.11,72.08c-3.5,0.4-6.58-2.37-6.6-5.9l-0.95-209.84c-0.01-2.38,1.42-4.49,3.59-5.47c21.91-9.89,39.11-26.76,47.78-47.27c1.83-4.32,7.62-5.03,10.33-1.2l134.27,189.38C1575.69,895.77,1575.13,899.45,1572.52,901.36z' },
  { angle: 76.9, color: 'green', d: 'M1342.45,767.69l0.94,202.59c0.02,3.29-2.64,5.97-5.92,5.97c-0.13,0-0.26,0-0.4,0c-36.09,0-70.98-4.58-103.95-13.11c-3.02,1.76-4.7,2.74-7.72,4.5c-17.99,65.84-58.79,123.89-114.59,167.24c-2.66,2.07-6.53,1.46-8.47-1.29l-145.2-204.81c-1.39-1.96-1.41-4.53-0.18-6.59c6.64-11.09,10.65-23.59,11.26-36.84c0.03-1.19,0.1-2.39,0.1-3.61c0-1.19-0.06-2.39-0.1-3.58V352c0-3.28,2.66-5.94,5.94-5.94h257.44c3.28,0,5.94,2.66,5.94,5.94v314.86c0,0.74-0.03,1.51-0.1,2.29c-0.03,0.26-0.03,0.48-0.03,0.74c-0.06,0.64-0.1,1.26-0.1,1.9c-0.03,0.9-0.06,1.77-0.06,2.68c0,2.19,0.1,4.32,0.29,6.45c3.77,45.22,46.54,80.87,98.82,80.87c0.02,0,0.04,0,0.06,0C1339.72,761.77,1342.43,764.38,1342.45,767.69z' },
  { angle: 128.3, color: 'tan', d: 'M937.56,952.32l140.32,197.93c1.98,2.8,1.21,6.72-1.72,8.5c-53.01,32.26-116.1,52.56-184.28,56.52c-3.39,0.2-6.25-2.53-6.27-5.92l-1.11-236.39c-0.01-2.83,1.96-5.33,4.74-5.84c14.89-2.77,28.57-8.43,40.2-16.29C932.1,949.03,935.7,949.7,937.56,952.32z' },
  { angle: 180, color: 'tan', d: 'M843.91,1215.36c-64.56-3.52-124.62-21.73-175.93-50.85c-2.96-1.68-3.87-5.53-2.02-8.39l131.75-204.29c1.82-2.82,5.59-3.56,8.35-1.65c11.11,7.7,24.15,13.38,38.41,16.42c2.69,0.57,4.57,3.01,4.58,5.75l1.11,237.03C850.17,1212.79,847.32,1215.55,843.91,1215.36z' },
  { angle: 231.1, color: 'green', d: 'M778.53,926.93l-137.46,213.2c-1.84,2.86-5.73,3.62-8.48,1.62c-60.72-44.23-105.09-105.26-123.93-175c-3.01-1.77-4.68-2.75-7.69-4.52c-32.58,8.26-66.99,12.72-102.6,12.72c-187.39,0-342.17-122.77-365.98-281.83v-0.03c-0.23-1.55-0.35-3.09-0.35-4.64V349.48c0-3.28,2.66-5.94,5.93-5.94l257.44-0.28c3.28,0,5.95,2.66,5.95,5.94v324.04c0,0.64-0.03,1.29-0.06,1.9c-0.03,0.61-0.06,1.19-0.1,1.81c-0.03,0.32-0.03,0.61-0.03,0.93c-0.03,0.9-0.06,1.84-0.06,2.77c0,2.19,0.1,4.32,0.26,6.48c3.77,45.19,46.57,80.87,98.85,80.87c53.34,0,96.85-37.16,98.98-83.74c0.06-1.19,0.1-2.42,0.1-3.61c0-1.19-0.03-2.39-0.1-3.58V352c0-3.28,2.66-5.94,5.94-5.94h257.44c3.28,0,5.94,2.66,5.94,5.94v522.21c0,0.14-0.01,0.28-0.02,0.43c-0.21,2.32-0.34,4.7-0.34,7.1c0,2.51,0.13,5,0.35,7.45v0.03c1.1,11.23,4.63,21.85,10.12,31.45C779.75,922.63,779.76,925.04,778.53,926.93z' },
  { angle: 282.6, color: 'tan', d: 'M295.42,307.81l-257.44,0.28c-3.28,0-5.95-2.66-5.95-5.94V131.28c0-3.28,2.66-5.94,5.94-5.94h257.44c3.28,0,5.94,2.66,5.94,5.94v170.59C301.35,305.14,298.7,307.8,295.42,307.81z' },
];

const CX = 240;
const CY = 160;
const RADIUS = 115;
const HALF_WIDTH = 6.6;
// The wordmark's own coordinates are ~10x the canvas, so scale and shift them in.
const LOGO_SCALE = 0.11;
const LOGO_X = 144.3;
const LOGO_Y = 86.85;
const DEG = Math.PI / 180;

// How many points each outline is reduced to. Both shapes use the same count so
// point i of the arc can travel straight to point i of the letter.
export const SAMPLES = 220;
// Seconds for one full spin -> wordmark -> spin cycle.
export const DURATION = 3.6;

export const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeIn = (v) => v * v;
export const easeOut = (v) => 1 - (1 - v) ** 3;
export const easeInOut = (v) => (v < 0.5 ? 4 * v * v * v : 1 - (-2 * v + 2) ** 3 / 2);

export const toPath = (points) => {
  let d = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
  for (let i = 1; i < points.length; i += 1) {
    d += `L${points[i][0].toFixed(2)},${points[i][1].toFixed(2)}`;
  }
  return `${d}Z`;
};

// Spread `count` points evenly along a closed outline's perimeter, so the two
// shapes are sampled at comparable densities rather than by node position.
function resample(points, count) {
  const lengths = [0];
  let total = 0;
  for (let i = 1; i <= points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i % points.length];
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
    lengths.push(total);
  }

  const out = [];
  let seg = 0;
  for (let i = 0; i < count; i += 1) {
    const target = (total * i) / count;
    while (lengths[seg + 1] < target) seg += 1;
    const a = points[seg];
    const b = points[(seg + 1) % points.length];
    const span = lengths[seg + 1] - lengths[seg];
    const f = span > 0 ? (target - lengths[seg]) / span : 0;
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

// Positive or negative tells us which way an outline winds.
function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

// One arc of the ring — a thick 40° wedge with rounded caps — as a closed outline.
function arcOutline(deg) {
  const from = (deg - 20) * DEG;
  const to = (deg + 20) * DEG;
  const points = [];
  let i;
  let t;

  for (i = 0; i <= 40; i += 1) {
    t = from + ((to - from) * i) / 40;
    points.push([CX + (RADIUS + HALF_WIDTH) * Math.cos(t), CY + (RADIUS + HALF_WIDTH) * Math.sin(t)]);
  }
  const capTo = [CX + RADIUS * Math.cos(to), CY + RADIUS * Math.sin(to)];
  for (i = 1; i < 20; i += 1) {
    t = to + (Math.PI * i) / 20;
    points.push([capTo[0] + HALF_WIDTH * Math.cos(t), capTo[1] + HALF_WIDTH * Math.sin(t)]);
  }
  for (i = 0; i <= 40; i += 1) {
    t = to - ((to - from) * i) / 40;
    points.push([CX + (RADIUS - HALF_WIDTH) * Math.cos(t), CY + (RADIUS - HALF_WIDTH) * Math.sin(t)]);
  }
  const capFrom = [CX + RADIUS * Math.cos(from), CY + RADIUS * Math.sin(from)];
  for (i = 1; i < 20; i += 1) {
    t = from + Math.PI + (Math.PI * i) / 20;
    points.push([capFrom[0] + HALF_WIDTH * Math.cos(t), capFrom[1] + HALF_WIDTH * Math.sin(t)]);
  }

  return resample(points, SAMPLES);
}

// Walk a wordmark piece's path with the browser's own path maths, then map it
// onto the loader canvas.
function logoOutline(d) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  document.body.appendChild(svg);

  const length = path.getTotalLength();
  const points = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    const pt = path.getPointAtLength((length * i) / SAMPLES);
    points.push([LOGO_X + LOGO_SCALE * pt.x, LOGO_Y + LOGO_SCALE * pt.y]);
  }

  document.body.removeChild(svg);
  return resample(points, SAMPLES);
}

// Give both outlines the same winding and pick the rotation of `b` that leaves
// its points closest to `a`'s — without this the shape turns inside out mid-morph.
function align(a, b) {
  let candidate = signedArea(a) * signedArea(b) < 0 ? b.slice().reverse() : b;

  let bestOffset = 0;
  let bestScore = Infinity;
  for (let k = 0; k < SAMPLES; k += 1) {
    let score = 0;
    for (let i = 0; i < SAMPLES; i += 4) {
      const p = a[i];
      const q = candidate[(i + k) % SAMPLES];
      score += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
      if (score > bestScore) break;
    }
    if (score < bestScore) {
      bestScore = score;
      bestOffset = k;
    }
  }

  const out = [];
  for (let j = 0; j < SAMPLES; j += 1) out.push(candidate[(j + bestOffset) % SAMPLES]);
  return out;
}

// Sampling every piece costs a few milliseconds, and the shapes never change —
// so the first loader on the page pays for it and the rest reuse this.
let cached = null;

export function buildShapes() {
  if (cached) return cached;
  cached = PIECES.map((piece, rank) => {
    const arc = arcOutline(piece.angle);
    return { arc, logo: align(arc, logoOutline(piece.d)), color: piece.color, rank };
  });
  return cached;
}
