import { useState } from 'react';
import House from '@/assets/icons/house.svg?react';
import Lightbulb from '@/assets/icons/lightbulb.svg?react';
import Presentation from '@/assets/icons/presentation.svg?react';
import Video from '@/assets/icons/video.svg?react';
import UserPlus from '@/assets/icons/user-plus.svg?react';
import UserRound from '@/assets/icons/user-round.svg?react';
import Settings from '@/assets/icons/settings.svg?react';
import LogOut from '@/assets/icons/log-out.svg?react';
import Pin from '@/assets/icons/pin.svg?react';
import PinOff from '@/assets/icons/pin-off.svg?react';
import './Sidebar.css';

const defaultItems = [
  { key: 'home', label: 'Home', icon: House },
  { key: 'ideas', label: 'Ideas', icon: Lightbulb },
  { key: 'projects', label: 'My projects', icon: Presentation },
  { key: 'meetings', label: 'Meetings', icon: Video },
  { key: 'profiles', label: 'Profiles', icon: UserPlus },
  { key: 'profile', label: 'My profile', icon: UserRound },
];

const defaultFooter = [
    { key: 'settings', label: 'Settings', icon: Settings },
	{ key: 'logout', label: 'Log out', icon: LogOut },
];

export default function Sidebar({
  items = defaultItems,
  footer = defaultFooter,
  activeKey,
  defaultActiveKey = 'projects',
  onNavigate,
}) {
  const [internalActive, setInternalActive] = useState(defaultActiveKey);
  const active = activeKey ?? internalActive;
  const [pinned, setPinned] = useState(false);

  function handleNavigate(key) {
    if (activeKey === undefined) setInternalActive(key);
    onNavigate?.(key);
  }

  function renderItem(item) {
    const Icon = item.icon;
    const isActive = item.key === active;
    return (
      <li key={item.key}>
        <button
          type="button"
          className={`bayn-sidebar__item${isActive ? ' bayn-sidebar__item--active' : ''}`}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => handleNavigate(item.key)}
        >
          <span className="bayn-sidebar__icon">
            <span className="bayn-sidebar__icon-tile">
              <Icon width={26} height={26} aria-hidden="true" />
            </span>
          </span>
          <span className="bayn-sidebar__label">{item.label}</span>
        </button>
      </li>
    );
  }

  return (
    <aside
      className={`bayn-sidebar${pinned ? ' bayn-sidebar--pinned' : ''}`}
      aria-label="Primary navigation"
    >
      <div className="bayn-sidebar__head">
        <button
          type="button"
          className="bayn-sidebar__pin"
          onClick={() => setPinned((p) => !p)}
          aria-pressed={pinned}
          title={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
        >
          <span className="bayn-sidebar__pin-icon">
            {pinned ? (
              <PinOff width={18} height={18} aria-hidden="true" />
            ) : (
              <Pin width={18} height={18} aria-hidden="true" />
            )}
          </span>
          <span className="bayn-sidebar__pin-label">{pinned ? 'Unpin' : 'Pin'}</span>
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
