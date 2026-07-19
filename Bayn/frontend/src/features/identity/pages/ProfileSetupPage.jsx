import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import IdentityLayout from '@/layouts/IdentityLayout';
import Stepper from '../components/Stepper';
import Button from '@/shared/components/Button';
import Input from '@/shared/components/Input';
import Select from '@/shared/components/Select';
import SkillsInput from '@/shared/components/SkillsInput';
import { validateName } from '../utils/validation';
import {
  getSaudiCountryId,
  getCities,
  searchSkills,
  getMySkills,
  updateProfile,
  addSkillToProfile,
  removeSkillFromProfile,
  getAllSpecializations,
  getMySpecializations,
  addSpecializationToProfile,
  removeSpecializationFromProfile,
} from '../services/authService';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import './ProfileSetupPage.css';

const BIO_MAX = 200;

// Values match the backend's ExperienceRange enum exactly.
const EXPERIENCE_OPTIONS = [
  { value: 'less_than_1', label: 'Less than 1 Year' },
  { value: '1-2', label: '1-2 Years' },
  { value: '2-3', label: '2-3 Years' },
  { value: '3-4', label: '3-4 Years' },
  { value: '5-10', label: '5-10 Years' },
  { value: '10+', label: '10+ Years' },
];

// Final step of account creation. The full name is captured here in both
// languages (a toggle switches which set is shown), moved off the account step.
export default function ProfileSetupPage({ onNavigate, initialData = {}, onDataChange }) {
  const { t } = useTranslation();

  const steps = [
    { key: 'account', label: t('steps.account') },
    { key: 'verification', label: t('steps.verification') },
    { key: 'profile', label: t('steps.profile') },
  ];

  const [firstNameEn, setFirstNameEn] = useState(initialData.firstNameEn || '');
  const [secondNameEn, setSecondNameEn] = useState(initialData.secondNameEn || '');
  const [thirdNameEn, setThirdNameEn] = useState(initialData.thirdNameEn || '');
  const [lastNameEn, setLastNameEn] = useState(initialData.lastNameEn || '');
  const [firstNameAr, setFirstNameAr] = useState(initialData.firstNameAr || '');
  const [secondNameAr, setSecondNameAr] = useState(initialData.secondNameAr || '');
  const [thirdNameAr, setThirdNameAr] = useState(initialData.thirdNameAr || '');
  const [lastNameAr, setLastNameAr] = useState(initialData.lastNameAr || '');

  const [specializations, setSpecializations] = useState(initialData.specializations || []);
  // The full catalog list, used as the (fixed) options for the dropdown.
  const [specializationOptions, setSpecializationOptions] = useState([]);
  // Experience and location are plain text fields for now; they become dropdown
  // components later.
  const [experience, setExperience] = useState(initialData.experience || '');
  const [location, setLocation] = useState(initialData.location || '');
  const [bio, setBio] = useState(initialData.bio || '');
  const [skills, setSkills] = useState(initialData.skills || []);

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [countryId, setCountryId] = useState(null);
  const [cityOptions, setCityOptions] = useState([]);
  // Built up as skill search results come in — resolves a chosen skill name
  // back to the skill_id the backend needs.
  const [skillIdByName, setSkillIdByName] = useState({});
  // Maps an already-saved skill name to its UserSkill row id, so a skill the
  // user removes here can be DELETEd on submit.
  const [skillRowIdByName, setSkillRowIdByName] = useState({});
  // Same two maps for specializations: name -> Specialization id (to add) and
  // name -> UserSpecialization row id (to remove).
  const [specIdByName, setSpecIdByName] = useState({});
  const [specRowIdByName, setSpecRowIdByName] = useState({});

  // Load the city list once (only Saudi Arabia is seeded today).
  useEffect(() => {
    (async () => {
      try {
        const saId = await getSaudiCountryId();
        setCountryId(saId);
        if (saId) {
          const cities = await getCities(saId);
          setCityOptions(cities.map((c) => ({ value: c.id, label: c.name })));
        }
      } catch {
        // Location becomes a plain disabled field if the catalog call fails.
      }
    })();
  }, []);

  async function handleSkillQuery(q) {
    const results = await searchSkills(q);
    setSkillIdByName((prev) => {
      const next = { ...prev };
      results.forEach((r) => { next[r.name] = r.id; });
      return next;
    });
    return results.map((r) => r.name);
  }

  // Load any already-saved skills so they show on entry, and so submit can
  // tell new picks from removals. Only seeds the field when it's still empty,
  // to avoid clobbering choices carried over from an earlier wizard step.
  useEffect(() => {
    getMySkills()
      .then((rows) => {
        if (!rows.length) return;
        setSkillIdByName((prev) => {
          const next = { ...prev };
          rows.forEach((r) => { next[r.skill.name] = r.skill_id; });
          return next;
        });
        setSkillRowIdByName(Object.fromEntries(rows.map((r) => [r.skill.name, r.id])));
        setSkills((cur) => (cur.length ? cur : rows.map((r) => r.skill.name)));
      })
      .catch(() => {});
  }, []);

  // The full specialization catalog — the fixed dropdown options plus the
  // name->id map needed to save a pick.
  useEffect(() => {
    getAllSpecializations()
      .then((list) => {
        setSpecializationOptions(list.map((s) => s.name));
        setSpecIdByName((prev) => {
          const next = { ...prev };
          list.forEach((s) => { next[s.name] = s.id; });
          return next;
        });
      })
      .catch(() => {});
  }, []);

  // Load already-saved specializations so they show on entry and submit can
  // tell new picks from removals. Only seeds when the field is still empty.
  useEffect(() => {
    getMySpecializations()
      .then((rows) => {
        if (!rows.length) return;
        setSpecIdByName((prev) => {
          const next = { ...prev };
          rows.forEach((r) => { next[r.specialization.name] = r.specialization_id; });
          return next;
        });
        setSpecRowIdByName(Object.fromEntries(rows.map((r) => [r.specialization.name, r.id])));
        setSpecializations((cur) => (cur.length ? cur : rows.map((r) => r.specialization.name)));
      })
      .catch(() => {});
  }, []);

  // Persist everything up so it survives navigating back to earlier steps.
  useEffect(() => {
    onDataChange?.({
      firstNameEn, secondNameEn, thirdNameEn, lastNameEn,
      firstNameAr, secondNameAr, thirdNameAr, lastNameAr,
      specializations, experience, location, bio, skills,
    });
  }, [firstNameEn, secondNameEn, thirdNameEn, lastNameEn, firstNameAr, secondNameAr, thirdNameAr, lastNameAr, specializations, experience, location, bio, skills]);


  // Both name languages are shown together. First and last names carry over
  // from the account step (captured on the sign-up form) so they are locked
  // here; only the middle names stay editable.
  const nameGroups = [
    {
      lng: 'en',
      heading: t('profile.langEnglish'),
      fields: [
        { key: 'firstNameEn', label: 'firstName', value: firstNameEn, set: setFirstNameEn, disabled: true },
        { key: 'secondNameEn', label: 'secondName', value: secondNameEn, set: setSecondNameEn },
        { key: 'thirdNameEn', label: 'thirdName', value: thirdNameEn, set: setThirdNameEn },
        { key: 'lastNameEn', label: 'lastName', value: lastNameEn, set: setLastNameEn, disabled: true },
      ],
    },
    {
      lng: 'ar',
      heading: t('profile.langArabic'),
      fields: [
        { key: 'firstNameAr', label: 'firstName', value: firstNameAr, set: setFirstNameAr, disabled: true },
        { key: 'secondNameAr', label: 'secondName', value: secondNameAr, set: setSecondNameAr },
        { key: 'thirdNameAr', label: 'thirdName', value: thirdNameAr, set: setThirdNameAr },
        { key: 'lastNameAr', label: 'lastName', value: lastNameAr, set: setLastNameAr, disabled: true },
      ],
    },
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

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');
    const found = collectErrors();
    setErrors(found);

    if (Object.values(found).some(Boolean)) return;

    setSubmitting(true);
    try {
      await updateProfile({
        second_name_ar: secondNameAr || null,
        third_name_ar: thirdNameAr || null,
        second_name_en: secondNameEn || null,
        third_name_en: thirdNameEn || null,
        years_of_experience: experience || null,
        country_id: countryId || null,
        city_id: location || null,
        bio: bio || null,
      });

      // Best-effort: add newly-chosen skills and drop removed ones. One failure
      // shouldn't block the rest or stop the user from reaching the app.
      const addedSkills = skills.filter((name) => !skillRowIdByName[name]);
      const removedSkills = Object.keys(skillRowIdByName).filter((name) => !skills.includes(name));
      // Same diff for the (single) specialization.
      const addedSpecs = specializations.filter((name) => !specRowIdByName[name]);
      const removedSpecs = Object.keys(specRowIdByName).filter((name) => !specializations.includes(name));
      await Promise.all([
        ...addedSkills.map((name) => {
          const skillId = skillIdByName[name];
          return skillId ? addSkillToProfile(skillId).catch(() => {}) : null;
        }),
        ...removedSkills.map((name) => removeSkillFromProfile(skillRowIdByName[name]).catch(() => {})),
        ...addedSpecs.map((name) => {
          const specId = specIdByName[name];
          return specId ? addSpecializationToProfile(specId).catch(() => {}) : null;
        }),
        ...removedSpecs.map((name) => removeSpecializationFromProfile(specRowIdByName[name]).catch(() => {})),
      ]);

      onNavigate('home');
    } catch (err) {
      setSubmitError(getApiErrorMessage(err, t('signup.errorGeneric')));
    } finally {
      setSubmitting(false);
    }
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
          {nameGroups.map(group => (
            <div key={group.lng} className="ps__names-group">
              <p className="ps__names-lang">{group.heading}</p>
              <div className="ps__names-grid">
                {group.fields.map(f => (
                  <Input
                    key={f.key}
                    label={t(`signup.${f.label}`)}
                    value={f.value}
                    onChange={e => { f.set(e.target.value); clearError(f.key); }}
                    disabled={f.disabled}
                    className="ps__input"
                    {...fieldError(f.key)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <hr className="ps__divider" />

        <SkillsInput
          label={t('profile.specializations')}
          value={specializations}
          onChange={setSpecializations}
          options={specializationOptions}
          max={1}
          removeLabelKey="profile.removeSpecialization"
          removeLabelParam="specialization"
        />

        <div className="ps__names-grid">
          <Select
            label={t('profile.experience')}
            value={experience}
            onChange={setExperience}
            options={EXPERIENCE_OPTIONS}
            className="ps__input"
          />
          <Select
            label={t('profile.location')}
            value={location}
            onChange={setLocation}
            options={cityOptions}
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

        <SkillsInput
          label={t('profile.skills')}
          value={skills}
          onChange={setSkills}
          onQuery={handleSkillQuery}
          max={7}
        />

        {submitError && <p className="ps__error">{submitError}</p>}

        <div className="ps__action-row">
          <Button type="submit" variant="primary" size="lg" trailingIcon className="ps__submit" disabled={submitting}>
            {submitting ? t('login.loading') : t('profile.finish')}
          </Button>
        </div>
      </form>
    </IdentityLayout>
  );
}
