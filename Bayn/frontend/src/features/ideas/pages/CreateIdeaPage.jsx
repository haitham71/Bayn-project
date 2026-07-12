import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Input from '@/shared/components/Input';
import Select from '@/shared/components/Select';
import Button from '@/shared/components/Button';
import Calendar from '@/shared/components/Calendar';
import Eye from '@/assets/icons/eye.svg?react';
import UserPlus from '@/assets/icons/user-plus.svg?react';
import CalendarIcon from '@/assets/icons/calendar.svg?react';
import X from '@/assets/icons/x.svg?react';
import './CreateIdeaPage.css';

const TITLE_MAX = 100;
const DESC_MAX = 2000;

const SIDEBAR_ROUTES = { home: 'home', projects: 'myprojects', profile: 'myprofile' };

const TEAM_OPTIONS = Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
const CATEGORY_OPTIONS = ['FinTech', 'HealthTech', 'EdTech', 'E-commerce', 'AI / ML', 'Other'].map((c) => ({ value: c, label: c }));
const STAGE_OPTIONS = ['Idea', 'Planning', 'Development', 'Launched'].map((s) => ({ value: s, label: s }));

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

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState(['React', 'React', 'React', 'React']);
  const [skillInput, setSkillInput] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [roles, setRoles] = useState('');
  const [category, setCategory] = useState('');
  const [stage, setStage] = useState('');

  function addSkill(value) {
    const v = value.trim();
    setSkillInput('');
    if (!v) return;
    setSkills([...skills, v]);
  }

  function removeSkill(index) {
    setSkills(skills.filter((_, i) => i !== index));
  }

  function handleSkillKey(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(skillInput);
    } else if (e.key === 'Backspace' && !skillInput && skills.length) {
      removeSkill(skills.length - 1);
    }
  }

  const summaryRows = [
    { icon: Eye, label: t('createIdea.visibility'), value: t('createIdea.visibilityValue') },
    { icon: UserPlus, label: t('createIdea.joinRequest'), value: t('createIdea.joinRequestValue') },
    { icon: CalendarIcon, label: t('createIdea.meetingsTime'), value: t('createIdea.showCalendar') },
  ];

  return (
    <div className="ci">
      <Sidebar
        activeKey="projects"
        onNavigate={(key) => SIDEBAR_ROUTES[key] && onNavigate?.(SIDEBAR_ROUTES[key])}
      />

      <div className="ci__main">
        <Navbar userName="Assad Al-saeed" />

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
              <Input
                label={t('createIdea.step2Placeholder')}
                multiline
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                supportingText={`${description.length}/${DESC_MAX}`}
                className="ci__input ci__input--counter"
              />
            </Step>

            <Step n={3} title={t('createIdea.step3Title')} note={t('createIdea.step3Note')}>
              <Input
                label={t('createIdea.step3Label')}
                supportingText={t('createIdea.step3Placeholder')}
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKey}
                onBlur={() => addSkill(skillInput)}
                className="ci__input"
              />
              {skills.length > 0 && (
                <ul className="ci__chips">
                  {skills.map((skill, i) => (
                    <li key={`${skill}-${i}`} className="ci__chip">
                      <span className="ci__chip-label">{skill}</span>
                      <button
                        type="button"
                        className="ci__chip-x"
                        onClick={() => removeSkill(i)}
                        aria-label={t('profile.removeSkill', { skill })}
                      >
                        <X width={14} height={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
                  options={CATEGORY_OPTIONS}
                  className="ci__input ci__input--sm"
                />
                <Select
                  label={t('createIdea.currentStage')}
                  value={stage}
                  onChange={setStage}
                  options={STAGE_OPTIONS}
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
              {summaryRows.map((row) => {
                const Icon = row.icon;
                return (
                  <li key={row.label} className="ci__summary-row">
                    <Icon width={22} height={22} aria-hidden="true" />
                    <span className="ci__summary-label">{row.label}</span>
                    <span className="ci__summary-value">{row.value}</span>
                  </li>
                );
              })}
            </ul>

            <Calendar />

            <div className="ci__actions">
              <Button variant="primary" size="sm" className="ci__publish">
                {t('createIdea.publish')}
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
