import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { getProject, updateProject } from '@/features/projects/services/projectService';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Button from '@/shared/components/Button';
import Eye from '@/assets/icons/eye.svg?react';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useIdeaForm } from '../hooks/useIdeaForm';
import IdeaStep from '../components/IdeaStep';
import IdeaFormFields from '../components/IdeaFormFields';
import SummaryToggle from '../components/SummaryToggle';
import './IdeaEditor.css';

// Owner-facing editor for an existing idea/project. Title and description are
// shown read-only (as on the idea view page); the rest of the announcement —
// skills, team size, roles, category, stage, visibility — stays editable and is
// saved via PATCH. Meeting slots have their own editor and aren't touched here.
export default function EditIdeaPage({ onNavigate }) {
  const { t } = useTranslation();
  const { fullName } = useCurrentUser();
  const { id } = useParams();
  const { form, setField, setForm, industryOptions, handleSkillQuery, seedSkillIds, skillIds } = useIdeaForm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  // Snapshot of the editable fields as loaded, to detect "nothing changed".
  const [committed, setCommitted] = useState(null);

  // Load the project once and prefill every field, including the chosen skills
  // and their name->id map (so a save can resend skill_ids).
  useEffect(() => {
    if (!id) return;
    getProject(id)
      .then((p) => {
        const skillNames = (p.skills || []).map((s) => s.name);
        const loaded = {
          roles: p.more_info || '',
          category: p.industry_id || '',
          stage: p.stage || '',
          teamSize: p.team_members_needed ? String(p.team_members_needed) : '',
          visibility: p.is_hidden ? 'private' : 'public',
          skills: skillNames,
        };
        setForm({ title: p.title || '', description: p.description || '', ...loaded });
        seedSkillIds(p.skills);
        setCommitted(loaded);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // True when every editable field still matches what was loaded.
  const sameSkills = (a, b) =>
    a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
  const unchanged =
    committed
    && form.roles === committed.roles
    && form.category === committed.category
    && form.stage === committed.stage
    && form.teamSize === committed.teamSize
    && form.visibility === committed.visibility
    && sameSkills(form.skills, committed.skills);

  async function handleSave() {
    setSaveError('');
    setSaveMsg('');
    if (!form.teamSize || !form.stage) {
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
          more_info: form.roles || null,
          industry_id: form.category || null,
          stage: form.stage,
          team_members_needed: Number(form.teamSize),
          is_hidden: form.visibility === 'private',
          skill_ids: skillIds(),
        }),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
      // Stay on the page after saving; refresh the baseline and confirm.
      setCommitted({
        roles: form.roles,
        category: form.category,
        stage: form.stage,
        teamSize: form.teamSize,
        visibility: form.visibility,
        skills: form.skills,
      });
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
              <p className="ci__readonly ci__readonly--title">{form.title}</p>
            </IdeaStep>

            <IdeaStep title={t('createIdea.step2Title')}>
              <div
                className="ci__readonly ci__richtext-view"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(form.description) }}
              />
            </IdeaStep>

            <IdeaFormFields
              form={form}
              setField={setField}
              industryOptions={industryOptions}
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
