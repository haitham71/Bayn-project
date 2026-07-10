// Typography tokens from Bayn design system
// Line-height is left auto, so it's not tokenized here.

export const fontFamily = {
  sans: "'Inter', system-ui, sans-serif",
  arabic: "'Tajawal', system-ui, sans-serif",
};

export const typography = {
  header1: { fontSize: 64, fontWeight: 700, letterSpacing: '-0.02em' },
  header2: { fontSize: 48, fontWeight: 600, letterSpacing: '-0.02em' },
  header3: { fontSize: 36, fontWeight: 550, letterSpacing: '-0.02em' },
  subtitle: { fontSize: 24, fontWeight: 500 },
  body: { fontSize: 20, fontWeight: 400 },
  buttonText: { fontSize: 20, fontWeight: 550 },
  small: { fontSize: 16, fontWeight: 400 },
  supporting: { fontSize: 12, fontWeight: 400 },
};

export default typography;
