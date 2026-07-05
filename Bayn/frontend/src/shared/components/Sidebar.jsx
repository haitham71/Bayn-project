import { useState } from 'react';
import House from '@/assets/icons/house.svg?react';
import Lightbulb from '@/assets/icons/lightbulb.svg?react';
import Presentation from '@/assets/icons/presentation.svg?react';
import Video from '@/assets/icons/video.svg?react';
import UserPlus from '@/assets/icons/user-plus.svg?react';
import UserRound from '@/assets/icons/user-round.svg?react';
import Settings from '@/assets/icons/settings.svg?react';
import LogOut from '@/assets/icons/log-out.svg?react';
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
            <Icon width={30} height={30} aria-hidden="true" />
          </span>
          <span className="bayn-sidebar__label">{item.label}</span>
        </button>
      </li>
    );
  }

  return (
    <aside className="bayn-sidebar" aria-label="Primary navigation">
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
