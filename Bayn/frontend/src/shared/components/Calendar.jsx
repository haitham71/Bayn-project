import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ChevronLeft from '@/assets/icons/chevron-left.svg?react';
import ChevronRight from '@/assets/icons/chevron-right.svg?react';
import ChevronDown from '@/assets/icons/chevron-down.svg?react';
import './Calendar.css';

// Normalises a Date or {year,month,day} into a "y-m-d" key.
function dayKey(y, m, d) {
  return `${y}-${m}-${d}`;
}

function toKey(entry) {
  if (entry instanceof Date) return dayKey(entry.getFullYear(), entry.getMonth(), entry.getDate());
  return dayKey(entry.year, entry.month, entry.day);
}

// Reusable month calendar. Month and year are chosen from dropdowns (or the
// chevrons); days present in `markedDates` are highlighted. Purely presentational
// for now — the projects rail swaps this for the cal.com data source later.
export default function Calendar({
  title,
  markedDates = [],
  initialDate = new Date(),
  yearRange = 5,
  onSelectDate,
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  const [view, setView] = useState({
    year: initialDate.getFullYear(),
    month: initialDate.getMonth(),
  });

  const marked = new Set(markedDates.map(toKey));

  function shiftMonth(delta) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const fmt = (opts, date) => new Intl.DateTimeFormat(locale, opts).format(date);

  // Dropdown option sources.
  const months = Array.from({ length: 12 }, (_, m) => ({
    value: m,
    label: fmt({ month: 'short' }, new Date(2023, m, 1)),
  }));
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: yearRange * 2 + 1 }, (_, i) => currentYear - yearRange + i);

  // Sunday-first weekday headers.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    fmt({ weekday: 'short' }, new Date(2023, 0, 1 + i)),
  );

  const firstWeekday = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  // Trailing next-month days needed to fill the final week row.
  const trailing = (7 - ((firstWeekday + daysInMonth) % 7)) % 7;

  // Midnight today, for dimming past days and marking the current one.
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <div className="cal">
      {title && <p className="cal__title">{title}</p>}

      <div className="cal__box">
      <div className="cal__head">
        <button type="button" className="cal__nav" onClick={() => shiftMonth(-1)} aria-label={t('calendar.prevMonth')}>
          <ChevronLeft width={18} height={18} aria-hidden="true" />
        </button>

        <div className="cal__selects">
          <div className="cal__select">
            <select
              value={view.month}
              onChange={(e) => setView((v) => ({ ...v, month: Number(e.target.value) }))}
              aria-label={t('calendar.month')}
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <ChevronDown width={18} height={18} aria-hidden="true" />
          </div>

          <div className="cal__select">
            <select
              value={view.year}
              onChange={(e) => setView((v) => ({ ...v, year: Number(e.target.value) }))}
              aria-label={t('calendar.year')}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown width={18} height={18} aria-hidden="true" />
          </div>
        </div>

        <button type="button" className="cal__nav" onClick={() => shiftMonth(1)} aria-label={t('calendar.nextMonth')}>
          <ChevronRight width={18} height={18} aria-hidden="true" />
        </button>
      </div>

      <div className="cal__grid" role="grid">
        {weekdays.map((wd, i) => (
          <span key={`wd-${i}`} className="cal__weekday">{wd}</span>
        ))}

        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`lead-${i}`} className="cal__cell cal__cell--empty" />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const cellDate = new Date(view.year, view.month, day);
          const isToday = cellDate.getTime() === todayStart.getTime();
          const isPast = cellDate < todayStart;
          // Green only marks upcoming days that have meetings/appointments.
          const isMarked = !isPast && !isToday && marked.has(dayKey(view.year, view.month, day));

          let cls = 'cal__cell';
          if (isToday) cls += ' cal__cell--today';
          else if (isPast) cls += ' cal__cell--past';
          else if (isMarked) cls += ' cal__cell--marked';

          return (
            <button
              key={`d-${day}`}
              type="button"
              className={cls}
              disabled={isPast}
              onClick={() => onSelectDate?.(cellDate)}
            >
              {day}
            </button>
          );
        })}

        {Array.from({ length: trailing }, (_, i) => (
          <span key={`trail-${i}`} className="cal__cell cal__cell--muted">{i + 1}</span>
        ))}
      </div>
      </div>
    </div>
  );
}
