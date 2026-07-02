import { forwardRef, useId } from 'react';
import './Input.css';

function SearchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
      <path d="m9 9 6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" />
    </svg>
  );
}

const Input = forwardRef(function Input(
  {
    label = 'Label',
    supportingText = '',
    errorText = '',
    error = false,
    disabled = false,
    leadingIcon = false,
    trailingIcon = false,
    multiline = false,
    onTrailingClick,
    id,
    className = '',
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id || autoId;

  const leadingNode = leadingIcon === true ? <SearchIcon /> : leadingIcon;
  const trailingNode =
    trailingIcon === true ? (error ? <ErrorIcon /> : <ClearIcon />) : trailingIcon;

  const helper = error && errorText ? errorText : supportingText;

  const classes = [
    'bayn-input',
    error && 'bayn-input--error',
    disabled && 'bayn-input--disabled',
    multiline && 'bayn-input--multiline',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const Field = multiline ? 'textarea' : 'input';

  return (
    <div className={classes}>
      <div className="bayn-input__field">
        {leadingNode && <span className="bayn-input__icon bayn-input__icon--leading">{leadingNode}</span>}

        <div className="bayn-input__control">
          <Field
            ref={ref}
            id={inputId}
            className="bayn-input__native"
            placeholder=" "
            disabled={disabled}
            aria-invalid={error || undefined}
            aria-describedby={helper ? `${inputId}-help` : undefined}
            {...rest}
          />
          <label htmlFor={inputId} className="bayn-input__label">
            {label}
          </label>
        </div>

        {trailingNode && (
          <button
            type="button"
            className="bayn-input__icon bayn-input__icon--trailing"
            onClick={onTrailingClick}
            tabIndex={onTrailingClick ? 0 : -1}
            aria-hidden={onTrailingClick ? undefined : true}
            disabled={disabled}
          >
            {trailingNode}
          </button>
        )}
      </div>

      {helper && (
        <p id={`${inputId}-help`} className="bayn-input__support">
          {helper}
        </p>
      )}
    </div>
  );
});

export default Input;
