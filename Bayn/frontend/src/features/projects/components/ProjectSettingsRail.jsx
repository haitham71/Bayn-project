import { useTranslation } from 'react-i18next';
import Button from '@/shared/components/Button';
import MeetingScheduler from '@/shared/components/MeetingScheduler';
import Eye from '@/assets/icons/eye.svg?react';
import './ProjectSettingsRail.css';

// Right rail: manage this project's visibility and meeting slots. Driven by the
// useProjectSettings controller passed in as `settings`.
export default function ProjectSettingsRail({ settings }) {
  const { t } = useTranslation();
  const { project, schedInitial, setMeetings, visibility, setVisibility, saving, saveMsg, saveError, handleSave } = settings;

  if (!project) return null;

  return (
    <section className="jr__manage">
      <h2 className="jr__manage-title">{t('joinRequests.manageTitle')}</h2>

      <ul className="jr__manage-rows">
        <li className="jr__manage-row">
          <Eye width={20} height={20} aria-hidden="true" />
          <span className="jr__manage-label">{t('createIdea.visibility')}</span>
          <div className="jr__toggle" role="group" aria-label={t('createIdea.visibility')}>
            <button
              type="button"
              className={`jr__toggle-opt${visibility === 'public' ? ' jr__toggle-opt--active' : ''}`}
              onClick={() => setVisibility('public')}
            >
              {t('createIdea.visibilityValue')}
            </button>
            <button
              type="button"
              className={`jr__toggle-opt${visibility === 'private' ? ' jr__toggle-opt--active' : ''}`}
              onClick={() => setVisibility('private')}
            >
              {t('createIdea.visibilityPrivate')}
            </button>
          </div>
        </li>
      </ul>

      <MeetingScheduler
        key={project.id}
        title={t('joinRequests.meetingTimes')}
        value={schedInitial}
        onChange={setMeetings}
        maxDays={3}
        maxSlots={3}
      />

      {saveError && <p className="jr__save-error">{saveError}</p>}
      {saveMsg && <p className="jr__save-msg">{saveMsg}</p>}

      <Button
        variant="primary"
        size="sm"
        className="jr__save"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? t('joinRequests.saving') : t('joinRequests.saveEdit')}
      </Button>
    </section>
  );
}
