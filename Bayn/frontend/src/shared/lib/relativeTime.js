// Largest-unit "3 hours ago" / "قبل 3 ساعات" formatting.
//
// Intl does the pluralising, which matters for Arabic: it has a dual form, so
// two hours is "ساعتين" and not "2 ساعات". A hand-written table would get that
// wrong.
const UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

export function timeAgo(iso, locale = 'en', now = Date.now()) {
  // Floor at one second: a clock skew between server and browser shouldn't
  // render a past event as "in 3 minutes", nor as "0 seconds ago".
  const seconds = Math.max(1, Math.floor((now - new Date(iso).getTime()) / 1000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });

  for (const [unit, unitSeconds] of UNITS) {
    if (seconds >= unitSeconds) {
      return rtf.format(-Math.floor(seconds / unitSeconds), unit);
    }
  }
  return rtf.format(-seconds, 'second');
}
