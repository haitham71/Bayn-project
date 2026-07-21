// Conversions between backend meeting slots ({ start_time, end_time } ISO) and
// the MeetingScheduler's value shape ([{ date, slots: [{ start, end }] }]).

export const hhmm = (d) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Backend slots -> scheduler value, grouped by day.
export function slotsToSchedulerValue(slots) {
  const byDay = new Map();
  (slots || []).forEach((s) => {
    const start = new Date(s.start_time);
    const end = new Date(s.end_time);
    const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
    if (!byDay.has(key)) {
      byDay.set(key, { date: new Date(start.getFullYear(), start.getMonth(), start.getDate()), slots: [] });
    }
    byDay.get(key).slots.push({ start: hhmm(start), end: hhmm(end) });
  });
  return [...byDay.values()];
}

// Scheduler value -> backend slots (combines each day with its times).
export function meetingsToSlots(days) {
  const out = [];
  (days || []).forEach((d) => {
    const date = d.date instanceof Date ? d.date : new Date(d.date);
    (d.slots || []).forEach((s) => {
      const [sh, sm] = s.start.split(':').map(Number);
      const [eh, em] = s.end.split(':').map(Number);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), sh, sm);
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), eh, em);
      out.push({ start_time: start.toISOString(), end_time: end.toISOString() });
    });
  });
  return out;
}
