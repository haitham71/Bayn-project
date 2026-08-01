import logoUrl from '@/assets/logo/Bayn-svg.svg?url';
import './Logo.css';

export default function Logo({ href = '#', className = '' }) {
  return (
    <a
      className={`bayn-logo${className ? ` ${className}` : ''}`}
      href={href}
      aria-label="Beyn home"
    >
      <img src={logoUrl} alt="Beyn" />
    </a>
  );
}
