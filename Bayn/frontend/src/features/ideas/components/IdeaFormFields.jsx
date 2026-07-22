import { useTranslation } from 'react-i18next';
import Input from '@/shared/components/Input';
import Select from '@/shared/components/Select';
import SkillsInput from '@/shared/components/SkillsInput';
import IdeaStep from './IdeaStep';
import TeamNeedsBuilder from './TeamNeedsBuilder';
import { MAX_TEAM } from '../hooks/useIdeaForm';

const TEAM_OPTIONS = Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
// Values match the backend's ProjectStage enum; labels are translated at render.
const STAGE_OPTIONS = [
  { value: 'planning', labelKey: 'createIdea.stagePlanning' },
  { value: 'development', labelKey: 'createIdea.stageDevelopment' },
  { value: 'launching', labelKey: 'createIdea.stageLaunching' },
];

// Steps 3-5 shared by both idea pages: skills, team size + roles, and category
// + stage. `numbered` shows the step numbers and guidance notes (the create
// flow); the edit page renders the same fields without them.
export default function IdeaFormFields({
  form,
  setField,
  industryOptions,
  specializationOptions,
  onSkillQuery,
  numbered,
}) {
  const { t } = useTranslation();
  const n = (x) => (numbered ? x : undefined);

  return (
    <>
      <IdeaStep n={n(3)} title={t('createIdea.step3Title')} note={numbered ? t('createIdea.step3Note') : undefined}>
        <SkillsInput
          label={t('createIdea.step3Label')}
          supportingText={t('createIdea.step3Placeholder')}
          value={form.skills}
          onChange={(v) => setField('skills', v)}
          onQuery={onSkillQuery}
        />
      </IdeaStep>

      <IdeaStep n={n(4)} title={t('createIdea.step4Title')}>
        {specializationOptions ? (
          <div className="ci__slots-block">
            <span className="ci__slots-title">{t('createIdea.teamNeedsTitle')}</span>
            <TeamNeedsBuilder
              needs={form.teamNeeds}
              onChange={(v) => setField('teamNeeds', v)}
              options={specializationOptions}
              max={MAX_TEAM}
            />
          </div>
        ) : (
          <div className="ci__row">
            <Select
              label={t('createIdea.teamMembers')}
              value={form.teamSize}
              onChange={(v) => setField('teamSize', v)}
              options={TEAM_OPTIONS}
              className="ci__input ci__input--sm"
            />
            <Input
              label={t('createIdea.rolesNeeded')}
              value={form.roles}
              onChange={(e) => setField('roles', e.target.value)}
              className="ci__input ci__input--grow"
            />
          </div>
        )}
      </IdeaStep>

      <IdeaStep n={n(5)} title={t('createIdea.step5Title')}>
        <div className="ci__row">
          <Select
            label={t('createIdea.category')}
            value={form.category}
            onChange={(v) => setField('category', v)}
            options={industryOptions}
            className="ci__input ci__input--sm"
          />
          <Select
            label={t('createIdea.currentStage')}
            value={form.stage}
            onChange={(v) => setField('stage', v)}
            options={STAGE_OPTIONS.map((s) => ({ value: s.value, label: t(s.labelKey) }))}
            className="ci__input ci__input--sm"
          />
        </div>
      </IdeaStep>
    </>
  );
}
