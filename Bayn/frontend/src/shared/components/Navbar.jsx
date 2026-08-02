import { useTranslation } from 'react-i18next';
import { useLangNavigate } from '@/shared/hooks/useLang';
import { useProfile } from '@/shared/hooks/useProfile';
import NotificationsMenu from '@/features/notifications/components/NotificationsMenu';
import MessagesMenu from '@/features/chat/components/MessagesMenu';
import './Navbar.css';

// Shared dashboard top bar: notification and message actions plus the
// signed-in user's profile chip, all on the trailing edge.
export default function Navbar({ userName }) {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const { data: profile } = useProfile();
  const name = userName || t('home.profileName');
  const initial = name.trim().charAt(0).toUpperCase();
  const avatarUrl = profile?.avatar_url || '';

  return (
    <header className="bayn-topbar">
      <div className="bayn-topbar__actions">
        <NotificationsMenu />

        <MessagesMenu />

        <button
          type="button"
          className="bayn-topbar__profile"
          onClick={() => navigate('/my-profile')}
          aria-label={t('sidebar.profile')}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="bayn-topbar__avatar bayn-topbar__avatar--img" />
          ) : (
            <span className="bayn-topbar__avatar" aria-hidden="true">{initial}</span>
          )}
          <span className="bayn-topbar__name">{name}</span>
        </button>
      </div>
    </header>
  );
}
