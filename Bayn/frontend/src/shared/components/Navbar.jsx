import { useTranslation } from 'react-i18next';
import Search from '@/assets/icons/search.svg?react';
import Bell from '@/assets/icons/bell.svg?react';
import MessageSquare from '@/assets/icons/message-square-text.svg?react';
import './Navbar.css';

// Shared dashboard top bar: search field on the leading edge, notification and
// message actions plus the signed-in user's profile chip on the trailing edge.
export default function Navbar({ userName, onSearch }) {
  const { t } = useTranslation();
  const name = userName || t('home.profileName');
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <header className="bayn-topbar">
      <form
        className="bayn-topbar__search"
        role="search"
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          type="search"
          className="bayn-topbar__search-input"
          placeholder={t('home.search')}
          aria-label={t('home.search')}
          onChange={(e) => onSearch?.(e.target.value)}
        />
        <Search className="bayn-topbar__search-icon" width={20} height={20} aria-hidden="true" />
      </form>

      <div className="bayn-topbar__actions">
        <button type="button" className="bayn-topbar__icon-btn" aria-label={t('home.notifications')}>
          <Bell width={24} height={24} aria-hidden="true" />
        </button>

        <button type="button" className="bayn-topbar__icon-btn" aria-label={t('home.messages')}>
          <MessageSquare width={24} height={24} aria-hidden="true" />
        </button>

        <button type="button" className="bayn-topbar__profile">
          <span className="bayn-topbar__avatar" aria-hidden="true">{initial}</span>
          <span className="bayn-topbar__name">{name}</span>
        </button>
      </div>
    </header>
  );
}
