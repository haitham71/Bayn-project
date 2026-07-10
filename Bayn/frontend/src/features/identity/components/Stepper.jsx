import Check from '@/assets/icons/check.svg?react';
import './Stepper.css';

// Horizontal step indicator. steps: [{ key, label }]; current is the
// zero-based index of the active step. Steps before it are marked done.
export default function Stepper({ steps = [], current = 0 }) {
  return (
    <ol className="bayn-stepper">
      {steps.map((step, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'upcoming';
        return (
          <li key={step.key} className={`bayn-stepper__step bayn-stepper__step--${state}`}>
            <span className="bayn-stepper__marker">
              {state === 'done' ? <Check width={16} height={16} aria-hidden="true" /> : i + 1}
            </span>
            <span className="bayn-stepper__label">{step.label}</span>
            {i < steps.length - 1 && <span className="bayn-stepper__line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
