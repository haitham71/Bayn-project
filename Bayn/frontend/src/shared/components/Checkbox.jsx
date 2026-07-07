import { forwardRef, useId } from 'react';
import CheckIcon from '@/assets/icons/check.svg?react';
import './Checkbox.css';

const Checkbox = forwardRef(function Checkbox(
  {
    label = '',
    checked,
    defaultChecked,
    disabled = false,
    id,
    className = '',
    onChange,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id || autoId;

  const classes = ['bayn-checkbox', disabled && 'bayn-checkbox--disabled', className]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={classes} htmlFor={inputId}>
      <span className="bayn-checkbox__control">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="bayn-checkbox__input"
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={onChange}
          {...rest}
        />
        <span className="bayn-checkbox__box" aria-hidden="true">
          <CheckIcon className="bayn-checkbox__check" width={14} height={14} />
        </span>
      </span>

      {label && <span className="bayn-checkbox__label">{label}</span>}
    </label>
  );
});

export default Checkbox;
