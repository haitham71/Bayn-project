import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLangSwitch } from '@/shared/hooks/useLang';
import House from '@/assets/icons/house.svg?react';
import Lightbulb from '@/assets/icons/lightbulb.svg?react';
import Presentation from '@/assets/icons/presentation.svg?react';
import Video from '@/assets/icons/video.svg?react';
import UserRound from '@/assets/icons/user-round.svg?react';
import Settings from '@/assets/icons/settings.svg?react';
import Languages from '@/assets/icons/languages.svg?react';
import LogOut from '@/assets/icons/log-out.svg?react';
import Pin from '@/assets/icons/pin.svg?react';
import PinOff from '@/assets/icons/pin-off.svg?react';
import BaynLogo from '@/assets/logo/Bayn-svg.svg?react';
import { logout } from '@/features/identity/services/authService';
import './Sidebar.css';

// `page` is the app page an item navigates to. Items without a page yet are
// inert until their destination exists.
const defaultItems = [
  { key: 'home', page: 'home', labelKey: 'sidebar.home', icon: House },
  { key: 'ideas', page: 'ideas', labelKey: 'sidebar.ideas', icon: Lightbulb },
  { key: 'projects', page: 'myprojects', labelKey: 'sidebar.projects', icon: Presentation },
  { key: 'meetings', page: 'meetings', labelKey: 'sidebar.meetings', icon: Video },
  { key: 'profile', page: 'myprofile', labelKey: 'sidebar.profile', icon: UserRound },
];

const defaultFooter = [
    { key: 'settings', page: 'settings', labelKey: 'sidebar.settings', icon: Settings },
	{ key: 'language', labelKey: 'app.switchLanguage', icon: Languages, action: 'toggleLanguage' },
	{ key: 'logout', labelKey: 'sidebar.logout', icon: LogOut, action: 'logout' },
];

export default function Sidebar({
  items = defaultItems,
  footer = defaultFooter,
  activeKey,
  defaultActiveKey = 'projects',
  onNavigate,
}) {
  const { t } = useTranslation();
  const toggleLanguage = useLangSwitch();
  const [internalActive, setInternalActive] = useState(defaultActiveKey);
  const active = activeKey ?? internalActive;
  const [pinned, setPinned] = useState(false);

  function handleNavigate(item) {
    if (activeKey === undefined) setInternalActive(item.key);
    if (item.page) onNavigate?.(item.page);
  }

  // Clears the stored tokens and sends the user back to the login page.
  function handleLogout() {
    logout();
    onNavigate?.('login');
  }

  function handleItemClick(item) {
    if (item.action === 'toggleLanguage') return toggleLanguage();
    if (item.action === 'logout') return handleLogout();
    return handleNavigate(item);
  }

  function renderItem(item) {
    const Icon = item.icon;
    const isAction = Boolean(item.action);
    const isActive = !isAction && item.key === active;
    const label = item.labelKey ? t(item.labelKey) : item.label;
    return (
      <li key={item.key}>
        <button
          type="button"
          className={`bayn-sidebar__item${isActive ? ' bayn-sidebar__item--active' : ''}`}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => handleItemClick(item)}
        >
          <span className="bayn-sidebar__icon">
            <span className="bayn-sidebar__icon-tile">
              <Icon width={26} height={26} aria-hidden="true" />
            </span>
          </span>
          <span className="bayn-sidebar__label">{label}</span>
        </button>
      </li>
    );
  }

  return (
    <aside
      className={`bayn-sidebar${pinned ? ' bayn-sidebar--pinned' : ''}`}
      aria-label={t('sidebar.primaryNav')}
    >
      <div className="bayn-sidebar__brand">
        <BaynLogo className="bayn-sidebar__logo" aria-hidden="true" />
      </div>

      <div className="bayn-sidebar__head">
        <button
          type="button"
          className="bayn-sidebar__pin"
          onClick={() => setPinned((p) => !p)}
          aria-pressed={pinned}
          title={pinned ? t('sidebar.unpinTitle') : t('sidebar.pinTitle')}
        >
          <span className="bayn-sidebar__pin-icon">
            {pinned ? (
              <PinOff width={18} height={18} aria-hidden="true" />
            ) : (
              <Pin width={18} height={18} aria-hidden="true" />
            )}
          </span>
          <span className="bayn-sidebar__pin-label">{pinned ? t('sidebar.unpin') : t('sidebar.pin')}</span>
        </button>
      </div>

      <nav className="bayn-sidebar__nav">
        <ul className="bayn-sidebar__list">{items.map(renderItem)}</ul>
      </nav>

      {footer.length > 0 && (
        <div className="bayn-sidebar__footer">
          <ul className="bayn-sidebar__list">{footer.map(renderItem)}</ul>
        </div>
      )}
    </aside>
  );
}
