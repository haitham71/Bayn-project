import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createProject } from '@/features/projects/services/projectService';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Input from '@/shared/components/Input';
import MarkdownEditor from '@/shared/components/MarkdownEditor';
import Button from '@/shared/components/Button';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import MeetingScheduler from '@/shared/components/MeetingScheduler';
import Eye from '@/assets/icons/eye.svg?react';
import UserPlus from '@/assets/icons/user-plus.svg?react';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { meetingsToSlots } from '@/features/meetings/lib/slots';
import { useIdeaForm, MAX_TEAM } from '../hooks/useIdeaForm';
import IdeaStep from '../components/IdeaStep';
import IdeaFormFields from '../components/IdeaFormFields';
import SummaryToggle from '../components/SummaryToggle';
import './IdeaEditor.css';

const TITLE_MAX = 100;
const DESC_MAX = 2000;

export default function CreateIdeaPage({ onNavigate }) {
  const { t } = useTranslation();
  const { fullName } = useCurrentUser();
  const { form, setField, industryOptions, specializationOptions, handleSkillQuery, skillIds } = useIdeaForm();

  const [meetings, setMeetings] = useState([]);
  const [joinOpen, setJoinOpen] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Validate first, then open the confirm dialog — publishing itself waits for
  // the user's confirmation.
  // Valid rows: a chosen specialization with at least one seat.
  const validNeeds = form.teamNeeds.filter((r) => r.specialization_id && (Number(r.count) || 0) > 0);
  // Team size is the sum of the seat counts.
  const totalSeats = validNeeds.reduce((sum, r) => sum + Number(r.count), 0);

  // Expand each need into one team_slots entry per seat (length == team size).
  function buildTeamSlots() {
    return validNeeds.flatMap((r) =>
      Array.from({ length: Number(r.count) }, () => ({
        specialization_id: r.specialization_id,
        alternate_specialization_id: r.alternate_specialization_id || null,
      })),
    );
  }

  function requestPublish() {
    setPublishError('');
    if (!form.title.trim() || !form.stage) {
      setPublishError(t('createIdea.requiredFields'));
      return;
    }
    if (validNeeds.length === 0) {
      setPublishError(t('createIdea.teamNeedsRequired'));
      return;
    }
    if (totalSeats > MAX_TEAM) {
      setPublishError(t('createIdea.teamNeedsMax', { max: MAX_TEAM }));
      return;
    }
    setConfirmOpen(true);
  }

  async function doPublish() {
    setConfirmOpen(false);
    setPublishing(true);
    try {
      // Hold the "publishing" state for at least a second so it reads as a real
      // step rather than a flash.
      await Promise.all([
        createProject({
          title: form.title.trim(),
          description: form.description.trim() || null,
          more_info: form.roles || null,
          industry_id: form.category || null,
          stage: form.stage,
          team_members_needed: totalSeats,
          team_slots: buildTeamSlots(),
          is_hidden: form.visibility === 'private',
          slots: meetingsToSlots(meetings),
          skill_ids: skillIds(),
          // NOTE: the join-request toggle isn't sent yet — the create endpoint
          // doesn't support it. Wire once the backend does.
        }),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      onNavigate?.('myprojects');
    } catch (err) {
      setPublishError(getApiErrorMessage(err, t('createIdea.publishError')));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="ci">
      <Sidebar activeKey="projects" onNavigate={onNavigate} />

      <div className="ci__main">
        <Navbar userName={fullName} />

        <main className="ci__body">
          {/* Numbered form */}
          <section className="ci__card ci__form">
            <IdeaStep n={1} title={t('createIdea.step1Title')} note={t('createIdea.step1Note')}>
              <Input
                label={t('createIdea.step1Placeholder')}
                value={form.title}
                onChange={(e) => setField('title', e.target.value.slice(0, TITLE_MAX))}
                supportingText={`${form.title.length}/${TITLE_MAX}`}
                className="ci__input ci__input--counter"
              />
            </IdeaStep>

            <IdeaStep
              n={2}
              title={t('createIdea.step2Title')}
              note={
                <>
                  {t('createIdea.step2NotePrefix')}
                  <span className="ci__note-em">{t('createIdea.step2NoteEmphasis')}</span>
                </>
              }
            >
              <MarkdownEditor
                placeholder={t('createIdea.step2Placeholder')}
                value={form.description}
                onChange={(v) => setField('description', v)}
                maxLength={DESC_MAX}
                className="ci__input"
              />
            </IdeaStep>

            <IdeaFormFields
              form={form}
              setField={setField}
              industryOptions={industryOptions}
              specializationOptions={specializationOptions}
              onSkillQuery={handleSkillQuery}
              numbered
            />
          </section>

          {/* Idea summary */}
          <aside className="ci__summary">
            <h2 className="ci__summary-title">{t('createIdea.summaryTitle')}</h2>
            <p className="ci__summary-ready">{t('createIdea.summaryReady')}</p>
            <p className="ci__summary-hint">{t('createIdea.summaryHint')}</p>

            <ul className="ci__summary-rows">
              <SummaryToggle
                icon={Eye}
                label={t('createIdea.visibility')}
                value={form.visibility}
                onChange={(v) => setField('visibility', v)}
                options={[
                  { value: 'public', label: t('createIdea.visibilityValue') },
                  { value: 'private', label: t('createIdea.visibilityPrivate') },
                ]}
              />
              <SummaryToggle
                icon={UserPlus}
                label={t('createIdea.joinRequest')}
                value={joinOpen}
                onChange={setJoinOpen}
                options={[
                  { value: true, label: t('createIdea.joinRequestValue') },
                  { value: false, label: t('createIdea.joinRequestOff') },
                ]}
              />
            </ul>

            <MeetingScheduler onChange={setMeetings} />

            {publishError && <p className="ci__error">{publishError}</p>}

            <div className="ci__actions">
              <Button
                variant="primary"
                size="sm"
                className="ci__publish"
                onClick={requestPublish}
                disabled={publishing}
              >
                {publishing ? t('createIdea.publishing') : t('createIdea.publish')}
              </Button>
            </div>
          </aside>
        </main>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={t('createIdea.confirmTitle')}
        message={t('createIdea.confirmMsg')}
        confirmLabel={t('createIdea.confirmYes')}
        cancelLabel={t('createIdea.confirmCancel')}
        onConfirm={doPublish}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
