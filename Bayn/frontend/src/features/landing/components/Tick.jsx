import Check from '@/assets/icons/check.svg?react';

// Bullet marker for the showcase feature lists.
export default function Tick() {
  return (
    <span className="tick">
      <Check width={13} height={13} aria-hidden="true" />
    </span>
  );
}
