import { useEffect, useId, useRef, useState } from 'react';
import ChevronDown from '@/assets/icons/chevron-down.svg?react';
import Search from '@/assets/icons/search.svg?react';
import useDropPlacement from '@/shared/hooks/useDropPlacement';
import './Select.css';

const MENU_MAX = 264; // keep in sync with .bayn-select__menu max-height

// A small round avatar for options that carry one (e.g. people pickers):
// shows the image, or the name's first letter when there's no picture.
function SelectAvatar({ src, name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <span className="bayn-select__avatar" aria-hidden="true">
      {src ? <img src={src} alt="" /> : <span className="bayn-select__avatar-fallback">{initial}</span>}
    </span>
  );
}

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
  searchable = false,
  searchPlaceholder = '',
  id,
  className = '',
}) {
  const autoId = useId();
  const listId = `${id || autoId}-list`;
  const rootRef = useRef(null);
  const fieldRef = useRef(null);
  const panelRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value) || null;
  const helper = error && errorText ? errorText : supportingText;
  const isFloating = open || selected != null;

  // The rows shown in the menu — filtered by the search query when searchable.
  const q = query.trim().toLowerCase();
  const visibleOptions = searchable && q
    ? options.filter((o) => String(o.label).toLowerCase().includes(q))
    : options;

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Keep the menu on screen — drops up near the bottom of the page.
  const drop = useDropPlacement(open, fieldRef, menuRef, MENU_MAX, {
    panelRef,
    deps: [visibleOptions.length],
  });

  // Reset the query and focus the search box each time the menu opens.
  useEffect(() => {
    if (open && searchable) {
      setQuery('');
      const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open, searchable]);

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
      setActive((i) => Math.min(i + 1, visibleOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (visibleOptions[active]) choose(visibleOptions[active]);
    }
  }

  // Typing in the search box resets the highlight to the first match.
  function handleSearchChange(e) {
    setQuery(e.target.value);
    setActive(0);
  }

  const classes = [
    'bayn-select',
    open && 'bayn-select--open',
    drop.up && 'bayn-select--up',
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
        ref={fieldRef}
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
            {selected ? (
              <span className="bayn-select__value-inner">
                {'avatar' in selected && <SelectAvatar src={selected.avatar} name={selected.label} />}
                {selected.label}
              </span>
            ) : (
              <span className="bayn-select__placeholder">{placeholder}</span>
            )}
          </span>
          <span className="bayn-select__label">{label}</span>
        </span>
        <span className="bayn-select__chev" aria-hidden="true">
          <ChevronDown width={20} height={20} />
        </span>
      </button>

      {open && (
        <div className="bayn-select__panel" ref={panelRef}>
          {searchable && (
            <div className="bayn-select__search">
              <Search width={16} height={16} aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                className="bayn-select__search-input"
                placeholder={searchPlaceholder}
                value={query}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
              />
            </div>
          )}
          <ul
            ref={menuRef}
            className="bayn-select__menu bayn-scroll"
            id={listId}
            role="listbox"
            style={drop.listMax ? { maxHeight: drop.listMax } : undefined}
          >
            {visibleOptions.length === 0 ? (
              <li className="bayn-select__empty">—</li>
            ) : (
              visibleOptions.map((option, i) => {
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
                    {'avatar' in option && <SelectAvatar src={option.avatar} name={option.label} />}
                    <span className="bayn-select__option-label">{option.label}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {helper && <p className="bayn-select__support">{helper}</p>}
    </div>
  );
}
