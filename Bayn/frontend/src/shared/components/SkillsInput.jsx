import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Input from '@/shared/components/Input';
import useDropPlacement from '@/shared/hooks/useDropPlacement';
import X from '@/assets/icons/x.svg?react';
import './SkillsInput.css';

const MENU_MAX = 240; // keep in sync with .skills__menu max-height

// Fallback suggestions until the backend supplies skills for the typed query.
const DEFAULT_SUGGESTIONS = [
  'React', 'Vue', 'Angular', 'Node js', 'Express', 'Python', 'Django', 'Flask',
  'Java', 'Spring', 'TypeScript', 'JavaScript', 'PHP', 'Laravel', 'Go', 'Rust',
  'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS',
  'UI/UX', 'Figma', 'Product Design', 'Marketing', 'Web Dev', 'Mobile Dev',
  'Flutter', 'Swift', 'Kotlin', 'Data Science', 'Machine Learning',
];

// Typeable skills field with an autocomplete dropdown. Free text is allowed
// (Enter/comma adds it), and suggestions are filtered from `options` — which the
// caller can later feed from a backend query. Chips render below the field.
export default function SkillsInput({
  label = 'Add skills',
  supportingText = '',
  value = [],
  onChange,
  options = DEFAULT_SUGGESTIONS,
  // Optional async(query) -> string[]. When given, suggestions come from this
  // (debounced) instead of filtering the static `options` list locally.
  onQuery,
  // Optional cap on how many skills may be selected at once.
  max,
  // Lets a caller reuse this field for another entity (e.g. specializations) by
  // pointing the chip's "remove" aria-label at a different translation key.
  removeLabelKey = 'profile.removeSkill',
  removeLabelParam = 'skill',
  className = '',
}) {
  const { t } = useTranslation();
  const rootRef = useRef(null);
  const fieldRef = useRef(null);
  const menuRef = useRef(null);

  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [remoteOptions, setRemoteOptions] = useState([]);

  const selected = new Set(value.map((v) => v.toLowerCase()));
  const query = input.trim().toLowerCase();

  useEffect(() => {
    // Fetch once the field is open — including an empty query, which asks the
    // backend for a starter list so options show on focus. Debounce only while
    // typing; the initial (empty) fetch fires immediately.
    if (!onQuery || !open) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await onQuery(query).catch(() => []);
      if (!cancelled) setRemoteOptions(results || []);
    }, query ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, onQuery, open]);

  const filtered = (onQuery ? remoteOptions : options).filter(
    (o) => !selected.has(o.toLowerCase()) && (onQuery || o.toLowerCase().includes(query)),
  );

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Keep the suggestions on screen — drops up near the bottom of the page.
  const menuOpen = open && filtered.length > 0;
  const drop = useDropPlacement(menuOpen, fieldRef, menuRef, MENU_MAX, {
    deps: [filtered.length],
  });

  // Only a known option may be added — free text is rejected.
  function addOption(option) {
    const atLimit = max != null && value.length >= max;
    if (!atLimit && !selected.has(option.toLowerCase())) onChange?.([...value, option]);
    setInput('');
    setActive(-1);
  }

  // Adds the typed value only if it matches an available option.
  function commitInput() {
    const match = (onQuery ? remoteOptions : options).find(
      (o) => o.toLowerCase() === input.trim().toLowerCase() && !selected.has(o.toLowerCase()),
    );
    if (match) addOption(match);
  }

  function removeSkill(index) {
    onChange?.(value.filter((_, i) => i !== index));
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0 && filtered[active]) addOption(filtered[active]);
      else commitInput();
    } else if (e.key === ',') {
      e.preventDefault();
      commitInput();
    } else if (e.key === 'Backspace' && !input && value.length) {
      removeSkill(value.length - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={`skills ${className}`.trim()} ref={rootRef}>
      <div className={`skills__field${drop.up ? ' skills__field--up' : ''}`} ref={fieldRef}>
        <Input
          label={label}
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="skills__input"
        />

        {menuOpen && (
          <ul
            ref={menuRef}
            className="skills__menu bayn-scroll"
            role="listbox"
            style={drop.listMax ? { maxHeight: drop.listMax } : undefined}
          >
            {filtered.map((opt, i) => (
              <li
                key={opt}
                role="option"
                aria-selected={i === active}
                className={`skills__option${i === active ? ' skills__option--active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addOption(opt)}
              >
                {opt}
              </li>
            ))}
          </ul>
        )}
      </div>

      {supportingText && <p className="skills__hint">{supportingText}</p>}

      {value.length > 0 && (
        <ul className="skills__chips">
          {value.map((skill, i) => (
            <li key={`${skill}-${i}`} className="skills__chip">
              <span className="skills__chip-label">{skill}</span>
              <button
                type="button"
                className="skills__chip-x"
                onClick={() => removeSkill(i)}
                aria-label={t(removeLabelKey, { [removeLabelParam]: skill })}
              >
                <X width={14} height={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
