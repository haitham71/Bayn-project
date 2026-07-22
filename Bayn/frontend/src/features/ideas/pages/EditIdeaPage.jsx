import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DescriptionView from '@/shared/components/DescriptionView';
import { getProject, getProjectSlots, replaceSlots, updateProject } from '@/features/projects/services/projectService';
import { slotsToSchedulerValue, meetingsToSlots } from '@/features/meetings/lib/slots';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Button from '@/shared/components/Button';
import MeetingScheduler from '@/shared/components/MeetingScheduler';
import NoAccess from '@/shared/components/NoAccess';
import Eye from '@/assets/icons/eye.svg?react';
import ArrowLeft from '@/assets/icons/arrow-left.svg?react';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useIdeaForm, MAX_TEAM } from '../hooks/useIdeaForm';
import IdeaStep from '../components/IdeaStep';
import IdeaFormFields from '../components/IdeaFormFields';
import SummaryToggle from '../components/SummaryToggle';
import './IdeaEditor.css';

// Collapse the project's per-seat team_slots into the builder's shape:
// one { specialization_id, alternate_specialization_id, count } per specialization.
function slotsToNeeds(slots) {
  const map = new Map();
  (slots || []).forEach((s) => {
    const row = map.get(s.specialization_id) || {
      specialization_id: s.specialization_id,
      alternate_specialization_id: s.alternate_specialization_id || '',
      count: 0,
    };
    row.count += 1;
    map.set(s.specialization_id, row);
  });
  return [...map.values()];
}

// Canonical key of a team_needs list, for change detection.
const needsKey = (needs) =>
  JSON.stringify((needs || []).map((r) => [r.specialization_id, r.alternate_specialization_id || '', Number(r.count) || 0]));

// Same idea for the meeting slots — compare the payload the API would receive,
// sorted so re-ordering the picked days alone doesn't count as a change.
const slotsKey = (meetings) =>
  JSON.stringify(meetingsToSlots(meetings).map((s) => `${s.start_time}|${s.end_time}`).sort());

// Owner-facing editor for an existing idea/project. Title and description are
// shown read-only (as on the idea view page); the rest of the announcement —
// skills, team size, roles, category, stage, visibility — stays editable and is
// saved via PATCH. The meeting times offered to applicants are edited here too,
// and go out on their own endpoint alongside that PATCH.
export default function EditIdeaPage({ onNavigate }) {
  const { t } = useTranslation();
  const { user, fullName } = useCurrentUser();
  const { id } = useParams();
  const {
    form,
    setField,
    setForm,
    industryOptions,
    specializationOptions,
    handleSkillQuery,
    seedSkillIds,
    skillIds,
  } = useIdeaForm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  // Snapshot of the editable fields as loaded, to detect "nothing changed".
  const [committed, setCommitted] = useState(null);
  // Meeting slots offered to applicants — the scheduler starts from what's saved
  // and the picked days live in `meetings` until the owner saves.
  const [schedInitial, setSchedInitial] = useState([]);
  const [meetings, setMeetings] = useState([]);
  // Editing an announcement is the owner's alone; the API refuses anyone else's
  // save, so don't hand them a filled-in form to begin with.
  const [ownerId, setOwnerId] = useState(null);
  // Only a successful load can decide this — a failed fetch must not read as
  // "not yours".
  const [projectLoaded, setProjectLoaded] = useState(false);
  const denied = projectLoaded && ownerId !== user?.id;

  // Load the project once and prefill every field, including the chosen skills
  // and their name->id map (so a save can resend skill_ids).
  useEffect(() => {
    if (!id) return;
    Promise.all([getProject(id), getProjectSlots(id).catch(() => [])])
      .then(([p, sl]) => {
        const skillNames = (p.skills || []).map((s) => s.name);
        const sched = slotsToSchedulerValue(sl || []);
        const loaded = {
          roles: p.more_info || '',
          category: p.industry_id || '',
          stage: p.stage || '',
          teamNeeds: slotsToNeeds(p.team_slots),
          visibility: p.is_hidden ? 'private' : 'public',
          skills: skillNames,
        };
        setForm({ title: p.title || '', description: p.description || '', ...loaded });
        seedSkillIds(p.skills);
        setSchedInitial(sched);
        setMeetings(sched);
        setOwnerId(p.owner?.id || null);
        setProjectLoaded(true);
        // meetings ride along in the baseline but aren't part of the idea form
        setCommitted({ ...loaded, meetings: sched });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Valid team-needs rows and the derived total seats.
  const validNeeds = form.teamNeeds.filter((r) => r.specialization_id && (Number(r.count) || 0) > 0);
  const totalSeats = validNeeds.reduce((sum, r) => sum + Number(r.count), 0);
  const buildTeamSlots = () =>
    validNeeds.flatMap((r) =>
      Array.from({ length: Number(r.count) }, () => ({
        specialization_id: r.specialization_id,
        alternate_specialization_id: r.alternate_specialization_id || null,
      })),
    );

  // True when every editable field still matches what was loaded.
  const sameSkills = (a, b) =>
    a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
  const slotsUnchanged = committed && slotsKey(meetings) === slotsKey(committed.meetings);
  const unchanged =
    committed
    && form.category === committed.category
    && form.stage === committed.stage
    && needsKey(form.teamNeeds) === needsKey(committed.teamNeeds)
    && form.visibility === committed.visibility
    && sameSkills(form.skills, committed.skills)
    && slotsUnchanged;

  async function handleSave() {
    setSaveError('');
    setSaveMsg('');
    if (!form.stage) {
      setSaveError(t('createIdea.requiredFields'));
      return;
    }
    if (validNeeds.length === 0) {
      setSaveError(t('createIdea.teamNeedsRequired'));
      return;
    }
    if (totalSeats > MAX_TEAM) {
      setSaveError(t('createIdea.teamNeedsMax', { max: MAX_TEAM }));
      return;
    }
    if (unchanged) {
      setSaveMsg(t('createIdea.noChanges'));
      return;
    }

    setSaving(true);
    try {
      // Keep the "saving" state up for at least a second so it doesn't flash by
      // on a fast response.
      await Promise.all([
        updateProject(id, {
          more_info: form.roles || null,
          industry_id: form.category || null,
          stage: form.stage,
          team_members_needed: totalSeats,
          team_slots: buildTeamSlots(),
          is_hidden: form.visibility === 'private',
          skill_ids: skillIds(),
        }),
        // Slots are a separate endpoint — only touched when they actually moved,
        // so saving the announcement can't wipe a slot an applicant already booked.
        slotsUnchanged ? Promise.resolve() : replaceSlots(id, meetingsToSlots(meetings)),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      // Stay on the page after saving; refresh the baseline and confirm.
      setCommitted({
        roles: form.roles,
        category: form.category,
        stage: form.stage,
        teamNeeds: form.teamNeeds,
        visibility: form.visibility,
        skills: form.skills,
        meetings,
      });
      setSaveMsg(t('createIdea.saved'));
    } catch (err) {
      setSaveError(getApiErrorMessage(err, t('createIdea.publishError')));
    } finally {
      setSaving(false);
    }
  }

  if (denied) {
    return (
      <div className="ci">
        <Sidebar activeKey="projects" onNavigate={onNavigate} />
        <div className="ci__main">
          <Navbar userName={fullName} />
          <NoAccess
            title={t('noAccess.ownerTitle')}
            message={t('noAccess.ownerMsg')}
            onAction={() => onNavigate?.('myprojects')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="ci">
      <Sidebar activeKey="projects" onNavigate={onNavigate} />

      <div className="ci__main">
        <Navbar userName={fullName} />

        <button type="button" className="ci__back" onClick={() => onNavigate?.('myprojects')}>
          <ArrowLeft width={22} height={22} aria-hidden="true" />
          {t('myProjects.backToProjects')}
        </button>

        <main className="ci__body">
          {/* Numbered form */}
          <section className="ci__card ci__form">
            <IdeaStep title={t('createIdea.step1Title')}>
              <p className="ci__readonly ci__readonly--title">{form.title}</p>
            </IdeaStep>

            <IdeaStep title={t('createIdea.step2Title')}>
              <DescriptionView className="ci__readonly ci__richtext-view" value={form.description} />
            </IdeaStep>

            <IdeaFormFields
              form={form}
              setField={setField}
              industryOptions={industryOptions}
              specializationOptions={specializationOptions}
              onSkillQuery={handleSkillQuery}
              numbered={false}
            />
          </section>

          {/* Summary + visibility */}
          <aside className="ci__summary">
            <h2 className="ci__summary-title">{t('createIdea.editSummaryTitle')}</h2>
            <p className="ci__summary-ready">{t('createIdea.editSummaryReady')}</p>
            <p className="ci__summary-hint">{t('createIdea.editSummaryHint')}</p>

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
            </ul>

            {/* Times applicants can pick from when they ask to join. Mounted only
                once the saved slots are in, so the scheduler seeds from them. */}
            {!loading && (
              <MeetingScheduler
                title={t('createIdea.applicantMeetingTimes')}
                value={schedInitial}
                onChange={setMeetings}
                maxDays={3}
                maxSlots={3}
              />
            )}

            {saveError && <p className="ci__error">{saveError}</p>}
            {saveMsg && <p className="ci__success">{saveMsg}</p>}

            <div className="ci__actions">
              <Button
                variant="primary"
                size="sm"
                className="ci__publish"
                onClick={handleSave}
                disabled={saving || loading}
              >
                {saving ? t('createIdea.saving') : t('createIdea.saveChanges')}
              </Button>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
