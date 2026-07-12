import { useEffect, useId, useRef, useState } from 'react';
import ChevronDown from '@/assets/icons/chevron-down.svg?react';
import './Select.css';

// Dropdown that mirrors the Input field styling (floating label, bottom border,
// supporting text) and opens a list of choices. Controlled via value/onChange.
export default function Select({
  label = 'Label',
  value,
  onChange,
  options = [],
  supportingText = '',
  errorText = '',
  error = false,
  disabled = false,
  placeholder = '',
  id,
  className = '',
}) {
  const autoId = useId();
  const listId = `${id || autoId}-list`;
  const rootRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const selected = options.find((o) => o.value === value) || null;
  const helper = error && errorText ? errorText : supportingText;
  const isFloating = open || selected != null;

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  function openMenu() {
    if (disabled) return;
    setActive(options.findIndex((o) => o.value === value));
    setOpen(true);
  }

  function choose(option) {
    onChange?.(option.value);
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (disabled) return;
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[active]) choose(options[active]);
    }
  }

  const classes = [
    'bayn-select',
    open && 'bayn-select--open',
    error && 'bayn-select--error',
    disabled && 'bayn-select--disabled',
    isFloating && 'bayn-select--filled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} ref={rootRef}>
      <button
        type="button"
        className="bayn-select__field"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-invalid={error || undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
      >
        <span className="bayn-select__control">
          <span className="bayn-select__value">
            {selected ? selected.label : <span className="bayn-select__placeholder">{placeholder}</span>}
          </span>
          <span className="bayn-select__label">{label}</span>
        </span>
        <span className="bayn-select__chev" aria-hidden="true">
          <ChevronDown width={20} height={20} />
        </span>
      </button>

      {open && (
        <ul className="bayn-select__menu bayn-scroll" id={listId} role="listbox">
          {options.map((option, i) => {
            const Icon = option.icon;
            const isSelected = option.value === value;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                className={`bayn-select__option${i === active ? ' bayn-select__option--active' : ''}${isSelected ? ' bayn-select__option--selected' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option)}
              >
                {Icon && <Icon width={22} height={22} aria-hidden="true" />}
                <span className="bayn-select__option-label">{option.label}</span>
              </li>
            );
          })}
        </ul>
      )}

      {helper && <p className="bayn-select__support">{helper}</p>}
    </div>
  );
}
