// Always Western digits — the big display font may not carry Arabic-Indic
// glyphs, and the stat numbers read cleaner in Latin either way.
export const fmtCount = (n) => new Intl.NumberFormat('en-US').format(n || 0);
