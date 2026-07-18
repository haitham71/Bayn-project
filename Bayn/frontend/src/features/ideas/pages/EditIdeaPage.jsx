import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { getIndustries, searchSkills } from '@/features/identity/services/authService';
import { getProject, updateProject } from '@/features/projects/services/projectService';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Input from '@/shared/components/Input';
import Select from '@/shared/components/Select';
import SkillsInput from '@/shared/components/SkillsInput';
import Button from '@/shared/components/Button';
import Eye from '@/assets/icons/eye.svg?react';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import IdeaStep from '../components/IdeaStep';
import './CreateIdeaPage.css';

const TEAM_OPTIONS = Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
// Values match the backend's ProjectStage enum; labels are translated at render.
const STAGE_OPTIONS = [
  { value: 'planning', labelKey: 'createIdea.stagePlanning' },
  { value: 'development', labelKey: 'createIdea.stageDevelopment' },
  { value: 'launching', labelKey: 'createIdea.stageLaunching' },
];

// Owner-facing editor for an existing idea/project. Title and description are
// shown read-only (as on the idea view page); the rest of the announcement —
// skills, team size, roles, category, stage, visibility — stays editable and is
// saved via PATCH. Meeting slots have their own editor and aren't touched here.
export default function EditIdeaPage({ onNavigate }) {
  const { t } = useTranslation();
  const { fullName } = useCurrentUser();
  const { id } = useParams();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState([]);
  const [teamSize, setTeamSize] = useState('');
  const [roles, setRoles] = useState('');
  const [category, setCategory] = useState('');
  const [stage, setStage] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [industryOptions, setIndustryOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  // Resolves a chosen skill name back to the skill_id sent on save.
  const [skillIdByName, setSkillIdByName] = useState({});
  // Snapshot of the editable fields as loaded, to detect "nothing changed".
  const [committed, setCommitted] = useState(null);

  // Categories come from the industries catalog (value = industry id).
  useEffect(() => {
    getIndustries()
      .then((rows) => setIndustryOptions(rows.map((r) => ({ value: r.id, label: r.name }))))
      .catch(() => {});
  }, []);

  // Load the project once and prefill every field, including the chosen skills
  // and their name->id map (so a save can resend skill_ids).
  useEffect(() => {
    if (!id) return;
    getProject(id)
      .then((p) => {
        setTitle(p.title || '');
        setDescription(p.description || '');
        setRoles(p.more_info || '');
        setCategory(p.industry_id || '');
        setStage(p.stage || '');
        setTeamSize(p.team_members_needed ? String(p.team_members_needed) : '');
        setVisibility(p.is_hidden ? 'private' : 'public');
        const skillNames = (p.skills || []).map((s) => s.name);
        setSkills(skillNames);
        setSkillIdByName((prev) => {
          const next = { ...prev };
          (p.skills || []).forEach((s) => { next[s.name] = s.id; });
          return next;
        });
        setCommitted({
          roles: p.more_info || '',
          category: p.industry_id || '',
          stage: p.stage || '',
          teamSize: p.team_members_needed ? String(p.team_members_needed) : '',
          visibility: p.is_hidden ? 'private' : 'public',
          skills: skillNames,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // Skill suggestions come from the backend catalog (same source as everywhere).
  async function handleSkillQuery(q) {
    const results = await searchSkills(q).catch(() => []);
    setSkillIdByName((prev) => {
      const next = { ...prev };
      results.forEach((r) => { next[r.name] = r.id; });
      return next;
    });
    return results.map((r) => r.name);
  }

  // True when every editable field still matches what was loaded.
  const sameSkills = (a, b) =>
    a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
  const unchanged =
    committed
    && roles === committed.roles
    && category === committed.category
    && stage === committed.stage
    && teamSize === committed.teamSize
    && visibility === committed.visibility
    && sameSkills(skills, committed.skills);

  async function handleSave() {
    setSaveError('');
    setSaveMsg('');
    if (!teamSize || !stage) {
      setSaveError(t('createIdea.requiredFields'));
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
          more_info: roles || null,
          industry_id: category || null,
          stage,
          team_members_needed: Number(teamSize),
          is_hidden: visibility === 'private',
          skill_ids: skills.map((name) => skillIdByName[name]).filter(Boolean),
        }),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      // Stay on the page after saving; refresh the baseline and confirm.
      setCommitted({ roles, category, stage, teamSize, visibility, skills });
      setSaveMsg(t('createIdea.saved'));
    } catch (err) {
      setSaveError(getApiErrorMessage(err, t('createIdea.publishError')));
    } finally {
      setSaving(false);
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
            <IdeaStep title={t('createIdea.step1Title')}>
              <p className="ci__readonly ci__readonly--title">{title}</p>
            </IdeaStep>

            <IdeaStep title={t('createIdea.step2Title')}>
              <div
                className="ci__readonly ci__richtext-view"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(description) }}
              />
            </IdeaStep>

            <IdeaStep title={t('createIdea.step3Title')}>
              <SkillsInput
                label={t('createIdea.step3Label')}
                supportingText={t('createIdea.step3Placeholder')}
                value={skills}
                onChange={setSkills}
                onQuery={handleSkillQuery}
              />
            </IdeaStep>

            <IdeaStep title={t('createIdea.step4Title')}>
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
            </IdeaStep>

            <IdeaStep title={t('createIdea.step5Title')}>
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
            </IdeaStep>
          </section>

          {/* Summary + visibility */}
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
            </ul>

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
