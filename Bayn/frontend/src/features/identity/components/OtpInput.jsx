import { useRef } from 'react';
import './OtpInput.css';

// Controlled group of single-digit boxes for OTP entry.
// value is the full string (e.g. "1234"); onChange gets the new string.
export default function OtpInput({
  length = 4,
  value = '',
  onChange,
  onComplete,
  disabled = false,
  error = false,
  autoFocus = false,
}) {
  const inputs = useRef([]);

  const digits = value.split('').slice(0, length);
  while (digits.length < length) digits.push('');

  function focusBox(index) {
    const el = inputs.current[index];
    if (el) el.focus();
  }

  function emit(next) {
    const joined = next.join('');
    onChange?.(joined);
    if (joined.length === length && !next.includes('')) {
      onComplete?.(joined);
    }
  }

  function handleChange(index, raw) {
    const char = raw.replace(/\D/g, '').slice(-1);
    if (!char) return;

    const next = [...digits];
    next[index] = char;
    emit(next);

    if (index < length - 1) focusBox(index + 1);
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
        emit(next);
      } else if (index > 0) {
        next[index - 1] = '';
        emit(next);
        focusBox(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusBox(index - 1);
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      focusBox(index + 1);
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    const next = Array(length).fill('');
    pasted.split('').forEach((c, i) => (next[i] = c));
    emit(next);
    focusBox(Math.min(pasted.length, length - 1));
  }

  const classes = ['bayn-otp', error && 'bayn-otp--error', disabled && 'bayn-otp--disabled']
    .filter(Boolean)
    .join(' ');

  return (
    // OTP is always entered left-to-right, even in an RTL layout.
    <div className={classes} dir="ltr" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          className="bayn-otp__box"
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
