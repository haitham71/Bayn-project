// A summary row: an icon, a label, and a two-option toggle. Used for the
// visibility and join-request settings on the idea editor's summary aside.
export default function SummaryToggle({ icon: Icon, label, value, options, onChange }) {
  return (
    <li className="ci__summary-row">
      <Icon width={22} height={22} aria-hidden="true" />
      <span className="ci__summary-label">{label}</span>
      <div className="ci__toggle" role="group" aria-label={label}>
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            className={`ci__toggle-opt${value === opt.value ? ' ci__toggle-opt--active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </li>
  );
}
