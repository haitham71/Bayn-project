import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Input from '@/shared/components/Input';
import X from '@/assets/icons/x.svg?react';
import './SkillsInput.css';

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
  className = '',
}) {
  const { t } = useTranslation();
  const rootRef = useRef(null);

  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [remoteOptions, setRemoteOptions] = useState([]);

  const selected = new Set(value.map((v) => v.toLowerCase()));
  const query = input.trim().toLowerCase();

  useEffect(() => {
    if (!onQuery || !query) {
      setRemoteOptions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const results = await onQuery(query).catch(() => []);
      if (!cancelled) setRemoteOptions(results || []);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, onQuery]);

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
      <div className="skills__field">
        <Input
          label={label}
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="skills__input"
        />

        {open && filtered.length > 0 && (
          <ul className="skills__menu bayn-scroll" role="listbox">
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
                aria-label={t('profile.removeSkill', { skill })}
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
