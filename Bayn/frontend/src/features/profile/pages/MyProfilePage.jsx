import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import { useProfileForm } from '../hooks/useProfileForm';
import { useAvatarUpload } from '../hooks/useAvatarUpload';
import ProfileForm from '../components/ProfileForm';
import ProfilePreview from '../components/ProfilePreview';
import './MyProfilePage.css';

export default function MyProfilePage({ onNavigate }) {
  const { t } = useTranslation();
  const form = useProfileForm();
  const avatar = useAvatarUpload();

  return (
    <div className="myp bayn-scroll">
      <Sidebar activeKey="profile" onNavigate={onNavigate} />

      <div className="myp__main">
        <Navbar userName={form.previewName} />

        <main className="myp__body">
          <ProfileForm form={form} />
          <ProfilePreview form={form} avatar={avatar} />
        </main>
      </div>

      <ConfirmDialog
        open={!!form.confirmState}
        title={t('myProfile.confirmTitle')}
        message={form.confirmState?.message}
        confirmLabel={t('myProfile.confirmYes')}
        cancelLabel={t('myProfile.confirmCancel')}
        onConfirm={form.handleConfirm}
        onCancel={form.cancelConfirm}
      />
    </div>
  );
}
