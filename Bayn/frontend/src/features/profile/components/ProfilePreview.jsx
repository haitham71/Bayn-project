import { useTranslation } from 'react-i18next';
import Button from '@/shared/components/Button';
import Camera from '@/assets/icons/camera.svg?react';
import MapPin from '@/assets/icons/map-pin.svg?react';
import './ProfilePreview.css';

// The read-only preview (right card): avatar picker plus the values from the
// last committed snapshot. `form` is the useProfileForm controller; `avatar` is
// the useAvatarUpload controller.
export default function ProfilePreview({ form, avatar }) {
  const { t } = useTranslation();
  const { previewName, committed, locationLabel, experienceLabel } = form;

  return (
    <aside className="myp__card myp__preview">
      <h2 className="myp__card-title">{t('myProfile.previewTitle')}</h2>

      <div className="myp__avatar-wrap">
        {avatar.pendingPreview ? (
          <img src={avatar.pendingPreview} alt="" className="myp__avatar myp__avatar--img" />
        ) : avatar.avatarUrl ? (
          <img src={avatar.avatarUrl} alt="" className="myp__avatar myp__avatar--img" />
        ) : (
          <span className="myp__avatar" aria-hidden="true">
            {previewName.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <button
          type="button"
          className="myp__avatar-btn"
          aria-label={t('myProfile.changePhoto')}
          onClick={() => avatar.fileInputRef.current?.click()}
          disabled={avatar.avatarUploading}
        >
          <Camera width={24} height={24} aria-hidden="true" />
        </button>
        <input
          ref={avatar.fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={avatar.handleAvatarChange}
        />
      </div>
      {avatar.avatarError && <p className="myp__avatar-error">{avatar.avatarError}</p>}
      {avatar.pendingFile && (
        <div className="myp__avatar-actions">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={avatar.confirmAvatarUpload}
            disabled={avatar.avatarUploading}
          >
            {avatar.avatarUploading ? t('myProfile.avatarUploading') : t('myProfile.avatarConfirm')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={avatar.cancelAvatarUpload}
            disabled={avatar.avatarUploading}
          >
            {t('myProfile.avatarCancel')}
          </Button>
        </div>
      )}

      <p className="myp__preview-name">{previewName}</p>
      <p className="myp__preview-username">{committed.username}</p>
      <p className="myp__preview-role">{committed.specializations.join('، ')}</p>
      <p className="myp__preview-location">
        <MapPin width={18} height={18} aria-hidden="true" />
        {locationLabel}
      </p>

      <hr className="myp__preview-divider" />

      <h3 className="myp__preview-heading">{t('myProfile.sectionBio')}</h3>
      <p className="myp__preview-bio">{committed.bio}</p>

      <h3 className="myp__preview-heading">{t('myProfile.sectionExperience')}</h3>
      <p className="myp__preview-exp">{experienceLabel}</p>

      <h3 className="myp__preview-heading">{t('myProfile.sectionSkills')}</h3>
      <ul className="myp__preview-skills">
        {committed.skills.map((skill) => (
          <li key={skill} className="myp__pill">{skill}</li>
        ))}
      </ul>
    </aside>
  );
}
