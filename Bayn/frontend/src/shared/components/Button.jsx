import { forwardRef, useRef, useState } from 'react';
import './Button.css';

function ChevronLeft() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m10 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    leadingIcon = false,
    trailingIcon = false,
    iconOnly = false,
    disabled = false,
    className = '',
    onPointerDown,
    ...rest
  },
  ref,
) {
  const [ripples, setRipples] = useState([]);
  const rippleId = useRef(0);

  // Tertiary has no fill, so no ripple
  const hasRipple = variant === 'primary' || variant === 'secondary';

  function handlePointerDown(e) {
    if (hasRipple && !disabled) {
      const rect = e.currentTarget.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const id = rippleId.current++;
      setRipples((prev) => [
        ...prev,
        {
          id,
          size,
          x: e.clientX - rect.left - size / 2,
          y: e.clientY - rect.top - size / 2,
        },
      ]);
    }
    onPointerDown?.(e);
  }

  function removeRipple(id) {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  }

  const leadingNode = leadingIcon === true ? <ChevronLeft /> : leadingIcon;
  const trailingNode = trailingIcon === true ? <ChevronRight /> : trailingIcon;

  const classes = [
    'bayn-btn',
    `bayn-btn--${variant}`,
    `bayn-btn--${size}`,
    iconOnly && 'bayn-btn--icon-only',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      {...rest}
    >
      {iconOnly ? (
        children || <ChevronRight />
      ) : (
        <>
          {leadingNode && <span className="bayn-btn__icon">{leadingNode}</span>}
          <span className="bayn-btn__label">{children}</span>
          {trailingNode && <span className="bayn-btn__icon">{trailingNode}</span>}
        </>
      )}

      {ripples.map((r) => (
        <span
          key={r.id}
          className="bayn-btn__ripple"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
          onAnimationEnd={() => removeRipple(r.id)}
        />
      ))}
    </button>
  );
});

export default Button;
