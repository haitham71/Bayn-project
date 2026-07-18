import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getIndustries, searchSkills } from '@/features/identity/services/authService';
import { createProject } from '@/features/projects/services/projectService';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Input from '@/shared/components/Input';
import Select from '@/shared/components/Select';
import SkillsInput from '@/shared/components/SkillsInput';
import RichTextEditor from '@/shared/components/RichTextEditor';
import Button from '@/shared/components/Button';
import MeetingScheduler from '@/shared/components/MeetingScheduler';
import Eye from '@/assets/icons/eye.svg?react';
import UserPlus from '@/assets/icons/user-plus.svg?react';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import './CreateIdeaPage.css';

const TITLE_MAX = 100;
const DESC_MAX = 2000;

const TEAM_OPTIONS = Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
// Values match the backend's ProjectStage enum; labels are translated at render.
const STAGE_OPTIONS = [
  { value: 'planning', labelKey: 'createIdea.stagePlanning' },
  { value: 'development', labelKey: 'createIdea.stageDevelopment' },
  { value: 'launching', labelKey: 'createIdea.stageLaunching' },
];

// Flatten the scheduler's [{ date, slots:[{start,end}] }] into backend meeting
// slots ({ start_time, end_time } ISO) by combining each day with its times.
function meetingsToSlots(days) {
  const out = [];
  (days || []).forEach((d) => {
    const date = d.date instanceof Date ? d.date : new Date(d.date);
    (d.slots || []).forEach((s) => {
      const [sh, sm] = s.start.split(':').map(Number);
      const [eh, em] = s.end.split(':').map(Number);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), sh, sm);
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), eh, em);
      out.push({ start_time: start.toISOString(), end_time: end.toISOString() });
    });
  });
  return out;
}

// One numbered form step: circled index + title + note, then its field(s).
function Step({ n, title, note, children }) {
  return (
    <section className="ci__step">
      <div className="ci__step-head">
        <span className="ci__step-num">{n}</span>
        <h2 className="ci__step-title">{title}</h2>
      </div>
      {note && <p className="ci__step-note">{note}</p>}
      <div className="ci__step-body">{children}</div>
    </section>
  );
}

export default function CreateIdeaPage({ onNavigate }) {
  const { t } = useTranslation();
  const { fullName } = useCurrentUser();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState([]);
  const [teamSize, setTeamSize] = useState('');
  const [roles, setRoles] = useState('');
  const [category, setCategory] = useState('');
  const [stage, setStage] = useState('');
  const [meetings, setMeetings] = useState([]);
  const [visibility, setVisibility] = useState('public');
  const [joinOpen, setJoinOpen] = useState(true);
  const [industryOptions, setIndustryOptions] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  // Resolves a chosen skill name back to the skill_id sent with the project.
  const [skillIdByName, setSkillIdByName] = useState({});

  // Categories come from the industries catalog (value = industry id).
  useEffect(() => {
    getIndustries()
      .then((rows) => setIndustryOptions(rows.map((r) => ({ value: r.id, label: r.name }))))
      .catch(() => {});
  }, []);

  // Skill suggestions come from the backend catalog (same source as the
  // profile pages), so the list stays in sync instead of a hardcoded one.
  async function handleSkillQuery(q) {
    const results = await searchSkills(q).catch(() => []);
    setSkillIdByName((prev) => {
      const next = { ...prev };
      results.forEach((r) => { next[r.name] = r.id; });
      return next;
    });
    return results.map((r) => r.name);
  }

  async function handlePublish() {
    setPublishError('');
    if (!title.trim() || !teamSize || !stage) {
      setPublishError(t('createIdea.requiredFields'));
      return;
    }

    setPublishing(true);
    try {
      const project = await createProject({
        title: title.trim(),
        description: description || null,
        more_info: roles || null,
        industry_id: category || null,
        stage,
        team_members_needed: Number(teamSize),
        is_hidden: visibility === 'private',
        slots: meetingsToSlots(meetings),
        skill_ids: skills.map((name) => skillIdByName[name]).filter(Boolean),
        // NOTE: the join-request toggle isn't sent yet — the create endpoint
        // doesn't support it. Wire once the backend does.
      });
      onNavigate?.('myprojects');
      return project;
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
            <Step n={1} title={t('createIdea.step1Title')} note={t('createIdea.step1Note')}>
              <Input
                label={t('createIdea.step1Placeholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                supportingText={`${title.length}/${TITLE_MAX}`}
                className="ci__input ci__input--counter"
              />
            </Step>

            <Step
              n={2}
              title={t('createIdea.step2Title')}
              note={
                <>
                  {t('createIdea.step2NotePrefix')}
                  <span className="ci__note-em">{t('createIdea.step2NoteEmphasis')}</span>
                </>
              }
            >
              <RichTextEditor
                placeholder={t('createIdea.step2Placeholder')}
                value={description}
                onChange={setDescription}
                maxLength={DESC_MAX}
                className="ci__input"
              />
            </Step>

            <Step n={3} title={t('createIdea.step3Title')} note={t('createIdea.step3Note')}>
              <SkillsInput
                label={t('createIdea.step3Label')}
                supportingText={t('createIdea.step3Placeholder')}
                value={skills}
                onChange={setSkills}
                onQuery={handleSkillQuery}
              />
            </Step>

            <Step n={4} title={t('createIdea.step4Title')}>
              <div className="ci__row">
                <Select
                  label={t('createIdea.teamMembers')}
                  value={teamSize}
                  onChange={setTeamSize}
                  options={TEAM_OPTIONS}
                  className="ci__input ci__input--sm"
                />
                <Input
                  label={t('createIdea.rolesNeeded')}
                  value={roles}
                  onChange={(e) => setRoles(e.target.value)}
                  className="ci__input ci__input--grow"
                />
              </div>
            </Step>

            <Step n={5} title={t('createIdea.step5Title')}>
              <div className="ci__row">
                <Select
                  label={t('createIdea.category')}
                  value={category}
                  onChange={setCategory}
                  options={industryOptions}
                  className="ci__input ci__input--sm"
                />
                <Select
                  label={t('createIdea.currentStage')}
                  value={stage}
                  onChange={setStage}
                  options={STAGE_OPTIONS.map((s) => ({ value: s.value, label: t(s.labelKey) }))}
                  className="ci__input ci__input--sm"
                />
              </div>
            </Step>
          </section>

          {/* Idea summary */}
          <aside className="ci__summary">
            <h2 className="ci__summary-title">{t('createIdea.summaryTitle')}</h2>
            <p className="ci__summary-ready">{t('createIdea.summaryReady')}</p>
            <p className="ci__summary-hint">{t('createIdea.summaryHint')}</p>

            <ul className="ci__summary-rows">
              <li className="ci__summary-row">
                <Eye width={22} height={22} aria-hidden="true" />
                <span className="ci__summary-label">{t('createIdea.visibility')}</span>
                <div className="ci__toggle" role="group" aria-label={t('createIdea.visibility')}>
                  <button
                    type="button"
                    className={`ci__toggle-opt${visibility === 'public' ? ' ci__toggle-opt--active' : ''}`}
                    onClick={() => setVisibility('public')}
                  >
                    {t('createIdea.visibilityValue')}
                  </button>
                  <button
                    type="button"
                    className={`ci__toggle-opt${visibility === 'private' ? ' ci__toggle-opt--active' : ''}`}
                    onClick={() => setVisibility('private')}
                  >
                    {t('createIdea.visibilityPrivate')}
                  </button>
                </div>
              </li>

              <li className="ci__summary-row">
                <UserPlus width={22} height={22} aria-hidden="true" />
                <span className="ci__summary-label">{t('createIdea.joinRequest')}</span>
                <div className="ci__toggle" role="group" aria-label={t('createIdea.joinRequest')}>
                  <button
                    type="button"
                    className={`ci__toggle-opt${joinOpen ? ' ci__toggle-opt--active' : ''}`}
                    onClick={() => setJoinOpen(true)}
                  >
                    {t('createIdea.joinRequestValue')}
                  </button>
                  <button
                    type="button"
                    className={`ci__toggle-opt${!joinOpen ? ' ci__toggle-opt--active' : ''}`}
                    onClick={() => setJoinOpen(false)}
                  >
                    {t('createIdea.joinRequestOff')}
                  </button>
                </div>
              </li>
            </ul>

            {/* Suspended until the backend supports meeting availability. */}
            <MeetingScheduler onChange={setMeetings} />

            {publishError && <p className="ci__error">{publishError}</p>}

            <div className="ci__actions">
              <Button
                variant="primary"
                size="sm"
                className="ci__publish"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? t('createIdea.publishing') : t('createIdea.publish')}
              </Button>
              <Button variant="secondary" size="sm" className="ci__draft">
                {t('createIdea.saveDraft')}
              </Button>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
