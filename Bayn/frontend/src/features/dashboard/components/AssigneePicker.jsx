import { useEffect, useRef, useState } from 'react';
import ChevronDown from '@/assets/icons/chevron-down.svg?react';
import Check from '@/assets/icons/check.svg?react';

// Round avatar for a member — image, or the name's first letter as a fallback.
function Avatar({ src, name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <span className="pd__assignee-avatar" aria-hidden="true">
      {src ? <img src={src} alt="" /> : <span className="pd__assignee-avatar-fallback">{initial}</span>}
    </span>
  );
}

// Multi-select people picker for a task's assignees. Shows the chosen members as
// avatar chips in the field, and opens a checklist of the team where each row
// toggles membership. Controlled via value (array of user ids) / onChange.
export default function AssigneePicker({ team, value, onChange, locale, placeholder }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const nameOf = (m) => (locale === 'ar' ? m.name_ar : m.name_en);
  const selected = team.filter((m) => value.includes(m.user_id));

  function toggle(id) {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  }

  return (
    <div className="pd__assignees" ref={rootRef}>
      <button
        type="button"
        className="pd__assignees-field"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="pd__assignees-value">
          {selected.length === 0 ? (
            <span className="pd__assignees-placeholder">{placeholder}</span>
          ) : (
            selected.map((m) => (
              <span key={m.user_id} className="pd__assignees-chip" title={nameOf(m)}>
                <Avatar src={m.avatar_url} name={nameOf(m)} />
                <span className="pd__assignees-chip-name">{nameOf(m)}</span>
              </span>
            ))
          )}
        </span>
        <span className="pd__assignees-chev" aria-hidden="true">
          <ChevronDown width={20} height={20} />
        </span>
      </button>

      {open && (
        <ul className="pd__assignees-menu bayn-scroll" role="listbox" aria-multiselectable="true">
          {team.length === 0 ? (
            <li className="pd__assignees-empty">—</li>
          ) : (
            team.map((m) => {
              const isSel = value.includes(m.user_id);
              return (
                <li
                  key={m.user_id}
                  role="option"
                  aria-selected={isSel}
                  className={`pd__assignees-option${isSel ? ' pd__assignees-option--selected' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggle(m.user_id)}
                >
                  <Avatar src={m.avatar_url} name={nameOf(m)} />
                  <span className="pd__assignees-option-name">{nameOf(m)}</span>
                  {isSel && <Check className="pd__assignees-check" width={16} height={16} aria-hidden="true" />}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
