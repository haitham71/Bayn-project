import { forwardRef, useId } from 'react';
import SearchIcon from '@/assets/icons/search.svg?react';
import ClearIcon from '@/assets/icons/x.svg?react';
import ErrorIcon from '@/assets/icons/alert-circle.svg?react';
import './Input.css';

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

  const leadingNode =
    leadingIcon === true ? <SearchIcon width={24} height={24} aria-hidden="true" /> : leadingIcon;
  const trailingNode =
    trailingIcon === true
      ? error
        ? <ErrorIcon width={20} height={20} aria-hidden="true" />
        : <ClearIcon width={20} height={20} aria-hidden="true" />
      : trailingIcon;

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
