import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Calendar from './Calendar';
import Select from './Select';
import Plus from '@/assets/icons/plus.svg?react';
import X from '@/assets/icons/x.svg?react';
import './MeetingScheduler.css';

// We work with minutes-from-midnight internally, then convert back to "HH:MM"
// for the <Select> values. These two helpers do that back-and-forth.
const toHHMM = (mins) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// One key per day so we can find/remove a day quickly (year-month-day).
function keyOf(d) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Turn the `value` prop (previously-saved meetings) into our internal shape.
// Days that have already passed are dropped, so they free up a slot and can be
// picked again — we only ever hold onto upcoming days, capped at maxDays.
function initDays(value, maxDays) {
  if (!Array.isArray(value)) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return value
    .map((d) => ({
      date: d.date instanceof Date ? d.date : new Date(d.date),
      slots: Array.isArray(d.slots) ? d.slots : [],
    }))
    .filter((d) => !Number.isNaN(d.date.getTime()) && d.date >= today)
    .slice(0, maxDays)
    .map((d) => ({
      key: keyOf(d.date),
      date: d.date,
      slots: d.slots.map((s, i) => ({ id: `init-${keyOf(d.date)}-${i}`, start: s.start, end: s.end })),
    }));
}

// A calendar you can pick several days on, and under each picked day you set the
// meeting times. I kept every limit as a prop instead of hard-coding it, because
// each page needs something a bit different (e.g. one day only, or longer meetings).
export default function MeetingScheduler({
  title,
  onChange,
  value,                   // previously-saved meetings to start from (optional)
  maxDays = 3,             // how many days can be picked
  maxSlots = 3,            // how many time ranges per day
  maxDurationMinutes = 90, // longest a single meeting can be
  dayStartHour = 6,        // earliest start shown in the dropdown
  dayEndHour = 22,         // latest start shown in the dropdown
  stepMinutes = 30,        // gap between the times in the dropdown
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  const [days, setDays] = useState(() => initDays(value, maxDays));
  const counter = useRef(0); // just to give each slot a stable unique id

  // All the start times to show (dayStartHour → dayEndHour, every stepMinutes).
  const startMinutes = [];
  for (let m = dayStartHour * 60; m <= dayEndHour * 60; m += stepMinutes) startMinutes.push(m);

  // Given a start, the ends we allow are start+step, start+2*step ... but never
  // further than maxDuration away — that's what caps the meeting length.
  const endMinutesFor = (start) => {
    const base = toMinutes(start);
    const ends = [];
    for (let inc = stepMinutes; inc <= maxDurationMinutes; inc += stepMinutes) ends.push(base + inc);
    return ends;
  };

  // Show the time the way the user's language writes it (e.g. "9:00 AM" / "٩:٠٠ ص").
  const timeLabel = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })
      .format(new Date(2023, 0, 1, h, m));
  };
  const startOptions = startMinutes.map((m) => ({ value: toHHMM(m), label: timeLabel(toHHMM(m)) }));
  const endOptions = (start) => endMinutesFor(start).map((m) => ({ value: toHHMM(m), label: timeLabel(toHHMM(m)) }));

  // Pick a sensible end when a slot is created: an hour if that's allowed,
  // otherwise the longest we can (in case maxDuration is under an hour).
  const defaultEnd = (start) => {
    const ends = endMinutesFor(start);
    const preferred = toMinutes(start) + 60;
    return toHHMM(ends.includes(preferred) ? preferred : ends[ends.length - 1]);
  };

  // Build a fresh slot. We clamp the start into the allowed window so it always
  // has valid options.
  const newSlot = (startMin = dayStartHour * 60) => {
    const start = Math.min(Math.max(startMin, dayStartHour * 60), dayEndHour * 60);
    return { id: `s${counter.current++}`, start: toHHMM(start), end: defaultEnd(toHHMM(start)) };
  };

  // Where the next slot should begin: right after the latest one already there,
  // so a new slot doesn't land on top of an existing one.
  const nextStart = (slots) =>
    slots.length ? Math.max(...slots.map((s) => toMinutes(s.end))) : dayStartHour * 60;

  // Keep the days sorted by date, save them, and hand them up to the parent.
  function commit(next) {
    const sorted = [...next].sort((a, b) => a.date - b.date);
    setDays(sorted);
    onChange?.(sorted);
  }

  // Click a day: if it's already picked remove it, otherwise add it (as long as
  // we're under the limit). When only one day is allowed we just swap it out.
  function toggleDate(date) {
    const k = keyOf(date);
    const day = { key: k, date, slots: [newSlot()] };
    if (days.some((d) => d.key === k)) commit(days.filter((d) => d.key !== k));
    else if (days.length < maxDays) commit([...days, day]);
    else if (maxDays === 1) commit([day]);
  }

  const updateDay = (k, fn) => commit(days.map((d) => (d.key === k ? fn(d) : d)));
  const addSlot = (k) =>
    updateDay(k, (d) => (d.slots.length < maxSlots ? { ...d, slots: [...d.slots, newSlot(nextStart(d.slots))] } : d));
  const removeSlot = (k, id) => updateDay(k, (d) => ({ ...d, slots: d.slots.filter((s) => s.id !== id) }));
  const removeDay = (k) => commit(days.filter((d) => d.key !== k));

  // When the start moves, the old end might now be too far away — if so, reset it.
  function setStart(k, id, start) {
    updateDay(k, (d) => ({
      ...d,
      slots: d.slots.map((s) => {
        if (s.id !== id) return s;
        const ends = endMinutesFor(start).map(toHHMM);
        return { ...s, start, end: ends.includes(s.end) ? s.end : defaultEnd(start) };
      }),
    }));
  }
  const setEnd = (k, id, end) =>
    updateDay(k, (d) => ({ ...d, slots: d.slots.map((s) => (s.id === id ? { ...s, end } : s)) }));

  const dateLabel = (d) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(d);

  // Find the slots that clash with another slot on the same day so we can flag
  // them in red. Two ranges overlap when each one starts before the other ends.
  function conflictingIds(slots) {
    const bad = new Set();
    for (let i = 0; i < slots.length; i += 1) {
      for (let j = i + 1; j < slots.length; j += 1) {
        const a = slots[i];
        const b = slots[j];
        if (toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end)) {
          bad.add(a.id);
          bad.add(b.id);
        }
      }
    }
    return bad;
  }

  return (
    <div className="sched">
      <Calendar title={title} selectedDates={days.map((d) => d.date)} onToggleDate={toggleDate} />

      <div className="sched__list">
        {days.length === 0 ? (
          <p className="sched__empty">{t('scheduler.noDates')}</p>
        ) : (
          days.map((d) => {
            const conflicts = conflictingIds(d.slots);
            return (
              <div key={d.key} className="sched__day">
                <div className="sched__day-head">
                  <span className="sched__day-label">{dateLabel(d.date)}</span>
                  <button
                    type="button"
                    className="sched__remove"
                    onClick={() => removeDay(d.key)}
                    aria-label={t('scheduler.removeDate', { date: dateLabel(d.date) })}
                  >
                    <X width={14} height={14} aria-hidden="true" />
                  </button>
                </div>

                <div className="sched__slots">
                  {d.slots.map((s) => (
                    <div key={s.id} className="sched__slot">
                      <Select
                        label={t('scheduler.from')}
                        value={s.start}
                        onChange={(v) => setStart(d.key, s.id, v)}
                        options={startOptions}
                        error={conflicts.has(s.id)}
                        className="sched__time"
                      />
                      <Select
                        label={t('scheduler.to')}
                        value={s.end}
                        onChange={(v) => setEnd(d.key, s.id, v)}
                        options={endOptions(s.start)}
                        error={conflicts.has(s.id)}
                        className="sched__time"
                      />
                      {d.slots.length > 1 && (
                        <button
                          type="button"
                          className="sched__slot-x"
                          onClick={() => removeSlot(d.key, s.id)}
                          aria-label={t('scheduler.removeTime')}
                        >
                          <X width={14} height={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}

                  {conflicts.size > 0 && <p className="sched__conflict">{t('scheduler.conflict')}</p>}

                  {d.slots.length < maxSlots && (
                    <button type="button" className="sched__add" onClick={() => addSlot(d.key)}>
                      <Plus width={16} height={16} aria-hidden="true" />
                      {t('scheduler.addTime')}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
