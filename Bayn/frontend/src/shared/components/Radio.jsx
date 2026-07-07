import { forwardRef, useId } from 'react';
import './Radio.css';

const Radio = forwardRef(function Radio(
  {
    label = '',
    name,
    value,
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

  const classes = ['bayn-radio', disabled && 'bayn-radio--disabled', className]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={classes} htmlFor={inputId}>
      <span className="bayn-radio__control">
        <input
          ref={ref}
          id={inputId}
          type="radio"
          className="bayn-radio__input"
          name={name}
          value={value}
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={onChange}
          {...rest}
        />
        <span className="bayn-radio__box" aria-hidden="true">
          <span className="bayn-radio__dot" />
        </span>
      </span>

      {label && <span className="bayn-radio__label">{label}</span>}
    </label>
  );
});

export default Radio;
