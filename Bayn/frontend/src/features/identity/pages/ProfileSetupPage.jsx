import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import IdentityLayout from '@/layouts/IdentityLayout';
import Stepper from '../components/Stepper';
import Button from '@/shared/components/Button';
import Input from '@/shared/components/Input';
import ChevronDown from '@/assets/icons/chevron-down.svg?react';
import X from '@/assets/icons/x.svg?react';
import { validateName } from '../utils/validation';
import './ProfileSetupPage.css';

const BIO_MAX = 200;

// Final step of account creation. The full name is captured here in both
// languages (a toggle switches which set is shown), moved off the account step.
export default function ProfileSetupPage({ onNavigate, initialData = {}, onDataChange }) {
  const { t } = useTranslation();

  const steps = [
    { key: 'account', label: t('steps.account') },
    { key: 'verification', label: t('steps.verification') },
    { key: 'profile', label: t('steps.profile') },
  ];

  const [nameLang, setNameLang] = useState(initialData.nameLang || 'en');
  const [firstNameEn, setFirstNameEn] = useState(initialData.firstNameEn || '');
  const [secondNameEn, setSecondNameEn] = useState(initialData.secondNameEn || '');
  const [thirdNameEn, setThirdNameEn] = useState(initialData.thirdNameEn || '');
  const [lastNameEn, setLastNameEn] = useState(initialData.lastNameEn || '');
  const [firstNameAr, setFirstNameAr] = useState(initialData.firstNameAr || '');
  const [secondNameAr, setSecondNameAr] = useState(initialData.secondNameAr || '');
  const [thirdNameAr, setThirdNameAr] = useState(initialData.thirdNameAr || '');
  const [lastNameAr, setLastNameAr] = useState(initialData.lastNameAr || '');

  const [title, setTitle] = useState(initialData.title || '');
  // Experience and location are plain text fields for now; they become dropdown
  // components later.
  const [experience, setExperience] = useState(initialData.experience || '');
  const [location, setLocation] = useState(initialData.location || '');
  const [bio, setBio] = useState(initialData.bio || '');
  const [skills, setSkills] = useState(initialData.skills || []);
  const [skillInput, setSkillInput] = useState('');

  const [errors, setErrors] = useState({});

  // Persist everything up so it survives navigating back to earlier steps.
  useEffect(() => {
    onDataChange?.({
      nameLang,
      firstNameEn, secondNameEn, thirdNameEn, lastNameEn,
      firstNameAr, secondNameAr, thirdNameAr, lastNameAr,
      title, experience, location, bio, skills,
    });
  }, [nameLang, firstNameEn, secondNameEn, thirdNameEn, lastNameEn, firstNameAr, secondNameAr, thirdNameAr, lastNameAr, title, experience, location, bio, skills]);

  function addSkill(value) {
    const v = value.trim();
    setSkillInput('');
    if (!v || skills.some((s) => s.toLowerCase() === v.toLowerCase())) return;
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

  // The name fields for the language the toggle is currently showing.
  const nameSet = nameLang === 'en'
    ? [
        { key: 'firstNameEn', label: 'firstName', value: firstNameEn, set: setFirstNameEn },
        { key: 'secondNameEn', label: 'secondName', value: secondNameEn, set: setSecondNameEn },
        { key: 'thirdNameEn', label: 'thirdName', value: thirdNameEn, set: setThirdNameEn },
        { key: 'lastNameEn', label: 'lastName', value: lastNameEn, set: setLastNameEn },
      ]
    : [
        { key: 'firstNameAr', label: 'firstName', value: firstNameAr, set: setFirstNameAr },
        { key: 'secondNameAr', label: 'secondName', value: secondNameAr, set: setSecondNameAr },
        { key: 'thirdNameAr', label: 'thirdName', value: thirdNameAr, set: setThirdNameAr },
        { key: 'lastNameAr', label: 'lastName', value: lastNameAr, set: setLastNameAr },
      ];

  function collectErrors() {
    const next = {};
    [
      ['firstNameEn', 'en', firstNameEn], ['secondNameEn', 'en', secondNameEn],
      ['thirdNameEn', 'en', thirdNameEn], ['lastNameEn', 'en', lastNameEn],
      ['firstNameAr', 'ar', firstNameAr], ['secondNameAr', 'ar', secondNameAr],
      ['thirdNameAr', 'ar', thirdNameAr], ['lastNameAr', 'ar', lastNameAr],
    ].forEach(([key, lang, value]) => {
      const err = validateName(value, { lang, required: true });
      if (err) next[key] = err;
    });
    return next;
  }

  function clearError(field) {
    setErrors(prev => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const found = collectErrors();
    setErrors(found);

    // Surface hidden-language name errors by switching the toggle to them.
    const enNameErr = found.firstNameEn || found.secondNameEn || found.thirdNameEn || found.lastNameEn;
    const arNameErr = found.firstNameAr || found.secondNameAr || found.thirdNameAr || found.lastNameAr;
    if (nameLang === 'en' && !enNameErr && arNameErr) setNameLang('ar');
    else if (nameLang === 'ar' && !arNameErr && enNameErr) setNameLang('en');

    if (Object.values(found).some(Boolean)) return;
    onNavigate('home');
  }

  const fieldError = field =>
    errors[field] ? { error: true, errorText: t(`signup.${errors[field]}`) } : {};

  return (
    <IdentityLayout contentClassName="ps__content">
      <h1 className="ps__title">{t('auth.createAccount')}</h1>

      <div className="ps__stepper">
        <Stepper steps={steps} current={2} />
      </div>

      <form className="ps__form" onSubmit={handleSubmit} noValidate>
        <p className="ps__subtitle">{t('profile.namesTitle')}</p>

        <div className="ps__names">
          <div className="ps__lang-toggle" role="group" aria-label="Name language">
            <button
              type="button"
              className={`ps__lang-opt${nameLang === 'en' ? ' ps__lang-opt--active' : ''}`}
              onClick={() => setNameLang('en')}
            >
              English
            </button>
            <button
              type="button"
              className={`ps__lang-opt${nameLang === 'ar' ? ' ps__lang-opt--active' : ''}`}
              onClick={() => setNameLang('ar')}
            >
              العربية
            </button>
          </div>

          <div className="ps__names-grid">
            {nameSet.map(f => (
              <Input
                key={f.key}
                label={t(`signup.${f.label}`, { lng: nameLang })}
                value={f.value}
                onChange={e => { f.set(e.target.value); clearError(f.key); }}
                className="ps__input"
                {...fieldError(f.key)}
              />
            ))}
          </div>
        </div>

        <hr className="ps__divider" />

        <Input
          label={t('profile.title')}
          supportingText={t('profile.titleHint')}
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="ps__input"
        />

        <div className="ps__names-grid">
          <Input
            label={t('profile.experience')}
            value={experience}
            onChange={e => setExperience(e.target.value)}
            trailingIcon={<ChevronDown width={20} height={20} aria-hidden="true" />}
            className="ps__input"
          />
          <Input
            label={t('profile.location')}
            value={location}
            onChange={e => setLocation(e.target.value)}
            trailingIcon={<ChevronDown width={20} height={20} aria-hidden="true" />}
            className="ps__input"
          />
        </div>

        <Input
          label={t('profile.bio')}
          multiline
          rows={4}
          maxLength={BIO_MAX}
          value={bio}
          onChange={e => setBio(e.target.value)}
          supportingText={`${bio.length}/${BIO_MAX}`}
          className="ps__bio"
        />

        <div className="ps__skills">
          <Input
            label={t('profile.skills')}
            value={skillInput}
            onChange={e => setSkillInput(e.target.value)}
            onKeyDown={handleSkillKey}
            onBlur={() => addSkill(skillInput)}
            className="ps__input"
          />
          {skills.length > 0 && (
            <ul className="ps__chips">
              {skills.map((skill, i) => (
                <li key={skill} className="ps__chip">
                  <span className="ps__chip-label">{skill}</span>
                  <button
                    type="button"
                    className="ps__chip-x"
                    onClick={() => removeSkill(i)}
                    aria-label={t('profile.removeSkill', { skill })}
                  >
                    <X width={14} height={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="ps__action-row">
          <Button type="submit" variant="primary" size="lg" trailingIcon className="ps__submit">
            {t('profile.finish')}
          </Button>
          <button type="button" className="ps__back-link" onClick={() => onNavigate('verification')}>
            {t('profile.back')}
          </button>
        </div>
      </form>
    </IdentityLayout>
  );
}
