import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  getSaudiCountryId,
  getCities,
  searchSkills,
  getMySkills,
  addSkillToProfile,
  removeSkillFromProfile,
  getAllSpecializations,
  getMySpecializations,
  addSpecializationToProfile,
  removeSpecializationFromProfile,
  updateProfile,
} from '@/features/identity/services/authService';
import { useProfile, profileQueryKey } from '@/shared/hooks/useProfile';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import { validateName } from '@/features/identity/utils/validation';
import { EXPERIENCE_OPTIONS, EMPTY_PREVIEW } from '../lib/constants';

// The brain of the profile page: the editable fields, the catalogs they draw
// from, the diff-based save, and the read-only preview values derived from the
// last committed (server-backed) snapshot.
export function useProfileForm() {
  const { t, i18n } = useTranslation();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  // Pending confirm modal: { message, onConfirm } while awaiting a yes/no.
  const [confirmState, setConfirmState] = useState(null);

  // Four-part name in both languages; experience/location/bio load on mount.
  const [firstNameEn, setFirstNameEn] = useState('');
  const [secondNameEn, setSecondNameEn] = useState('');
  const [thirdNameEn, setThirdNameEn] = useState('');
  const [lastNameEn, setLastNameEn] = useState('');
  const [firstNameAr, setFirstNameAr] = useState('');
  const [secondNameAr, setSecondNameAr] = useState('');
  const [thirdNameAr, setThirdNameAr] = useState('');
  const [lastNameAr, setLastNameAr] = useState('');
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [location, setLocation] = useState('');
  const [skills, setSkills] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [specializationOptions, setSpecializationOptions] = useState([]);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [cityOptions, setCityOptions] = useState([]);
  const [nameErrors, setNameErrors] = useState({});

  // name -> skill_id (to add) and name -> UserSkill row id (to remove).
  const [skillIdByName, setSkillIdByName] = useState({});
  const [skillRowIdByName, setSkillRowIdByName] = useState({});
  // name -> Specialization id (to add) and name -> UserSpecialization row id.
  const [specIdByName, setSpecIdByName] = useState({});
  const [specRowIdByName, setSpecRowIdByName] = useState({});

  // Values shown in the preview — updated only when a save is confirmed.
  const [committed, setCommitted] = useState(EMPTY_PREVIEW);

  async function handleSkillQuery(q) {
    const results = await searchSkills(q);
    setSkillIdByName((prev) => {
      const next = { ...prev };
      results.forEach((r) => { next[r.name] = r.id; });
      return next;
    });
    return results.map((r) => r.name);
  }

  // Seed the form from the cached profile once the query resolves.
  useEffect(() => {
    if (!profile) return;
    const u = profile;
    setFirstNameEn(u.first_name_en || '');
    setSecondNameEn(u.second_name_en || '');
    setThirdNameEn(u.third_name_en || '');
    setLastNameEn(u.last_name_en || '');
    setFirstNameAr(u.first_name_ar || '');
    setSecondNameAr(u.second_name_ar || '');
    setThirdNameAr(u.third_name_ar || '');
    setLastNameAr(u.last_name_ar || '');
    setBio(u.bio || '');
    setExperience(u.years_of_experience || '');
    setLocation(u.city_id || '');
    setCommitted((c) => ({
      ...c,
      username: u.username || '',
      firstNameEn: u.first_name_en || '',
      lastNameEn: u.last_name_en || '',
      firstNameAr: u.first_name_ar || '',
      lastNameAr: u.last_name_ar || '',
      bio: u.bio || '',
      experience: u.years_of_experience || '',
      location: u.city_id || '',
    }));
  }, [profile]);

  // City dropdown options.
  useEffect(() => {
    getSaudiCountryId()
      .then((saId) => (saId ? getCities(saId) : []))
      .then((cities) => setCityOptions(cities.map((c) => ({ value: c.id, label: c.name }))))
      .catch(() => {});
  }, []);

  // Saved skills — seed the field, the preview, and the name->id maps.
  useEffect(() => {
    getMySkills()
      .then((rows) => {
        const names = rows.map((r) => r.skill.name);
        setSkills(names);
        setCommitted((c) => ({ ...c, skills: names }));
        setSkillIdByName((prev) => {
          const next = { ...prev };
          rows.forEach((r) => { next[r.skill.name] = r.skill_id; });
          return next;
        });
        setSkillRowIdByName(Object.fromEntries(rows.map((r) => [r.skill.name, r.id])));
      })
      .catch(() => {});
  }, []);

  // Specialization catalog — the fixed dropdown options + name->id map.
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

  // Saved specializations — seed the field, the preview, and the name->row-id map.
  useEffect(() => {
    getMySpecializations()
      .then((rows) => {
        const names = rows.map((r) => r.specialization.name);
        setSpecializations(names);
        setCommitted((c) => ({ ...c, specializations: names }));
        setSpecIdByName((prev) => {
          const next = { ...prev };
          rows.forEach((r) => { next[r.specialization.name] = r.specialization_id; });
          return next;
        });
        setSpecRowIdByName(Object.fromEntries(rows.map((r) => [r.specialization.name, r.id])));
      })
      .catch(() => {});
  }, []);

  // Dismiss the "no changes" note as soon as the user edits any profile field.
  useEffect(() => {
    setProfileError((e) => (e ? '' : e));
  }, [specializations, bio, experience, location, skills, firstNameEn, lastNameEn, firstNameAr, lastNameAr]);

  const nameGroups = [
    {
      lng: 'en',
      heading: t('profile.langEnglish'),
      fields: [
        { key: 'firstNameEn', label: 'firstName', value: firstNameEn, set: setFirstNameEn, lang: 'en', required: true },
        { key: 'secondNameEn', label: 'secondName', value: secondNameEn, set: setSecondNameEn, lang: 'en', required: false },
        { key: 'thirdNameEn', label: 'thirdName', value: thirdNameEn, set: setThirdNameEn, lang: 'en', required: false },
        { key: 'lastNameEn', label: 'lastName', value: lastNameEn, set: setLastNameEn, lang: 'en', required: true },
      ],
    },
    {
      lng: 'ar',
      heading: t('profile.langArabic'),
      fields: [
        { key: 'firstNameAr', label: 'firstName', value: firstNameAr, set: setFirstNameAr, lang: 'ar', required: true },
        { key: 'secondNameAr', label: 'secondName', value: secondNameAr, set: setSecondNameAr, lang: 'ar', required: false },
        { key: 'thirdNameAr', label: 'thirdName', value: thirdNameAr, set: setThirdNameAr, lang: 'ar', required: false },
        { key: 'lastNameAr', label: 'lastName', value: lastNameAr, set: setLastNameAr, lang: 'ar', required: true },
      ],
    },
  ];
  const allNameFields = nameGroups.flatMap((g) => g.fields);

  function clearNameError(field) {
    setNameErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  const nameFieldError = (field) =>
    nameErrors[field] ? { error: true, errorText: t(`signup.${nameErrors[field]}`) } : {};

  function requestProfileUpdate() {
    const next = {};
    allNameFields.forEach((f) => {
      const err = validateName(f.value, { lang: f.lang, required: f.required });
      if (err) next[f.key] = err;
    });
    setNameErrors(next);
    if (Object.values(next).some(Boolean)) return;
    // Nothing to save if every field still matches the last saved snapshot.
    const unchanged =
      firstNameEn === committed.firstNameEn &&
      lastNameEn === committed.lastNameEn &&
      firstNameAr === committed.firstNameAr &&
      lastNameAr === committed.lastNameAr &&
      bio === committed.bio &&
      experience === committed.experience &&
      location === committed.location &&
      skills.length === committed.skills.length &&
      skills.every((s, i) => s === committed.skills[i]) &&
      specializations.length === committed.specializations.length &&
      specializations.every((s, i) => s === committed.specializations[i]);
    if (unchanged) {
      setProfileError(t('myProfile.noChanges'));
      return;
    }
    setConfirmState({ message: t('myProfile.confirmProfileMsg'), onConfirm: doProfileUpdate });
  }

  async function doProfileUpdate() {
    setProfileSaving(true);
    setProfileError('');
    try {
      const updated = await updateProfile({
        years_of_experience: experience || null,
        city_id: location || null,
        bio: bio || null,
      });

      // Persist skill changes: add the newly-chosen ones, remove the dropped
      // ones. Diff against the last committed (server-backed) list.
      const addedSkills = skills.filter((s) => !committed.skills.includes(s));
      const removedSkills = committed.skills.filter((s) => !skills.includes(s));
      const skillRowIds = { ...skillRowIdByName };
      await Promise.all([
        ...addedSkills.map(async (name) => {
          const skillId = skillIdByName[name];
          if (!skillId) return;
          const row = await addSkillToProfile(skillId).catch(() => null);
          if (row) skillRowIds[name] = row.id;
        }),
        ...removedSkills.map(async (name) => {
          const rowId = skillRowIdByName[name];
          if (rowId) await removeSkillFromProfile(rowId).catch(() => {});
          delete skillRowIds[name];
        }),
      ]);
      setSkillRowIdByName(skillRowIds);

      // Same add/remove diff for specializations.
      const addedSpecs = specializations.filter((s) => !committed.specializations.includes(s));
      const removedSpecs = committed.specializations.filter((s) => !specializations.includes(s));
      const specRowIds = { ...specRowIdByName };
      await Promise.all([
        ...addedSpecs.map(async (name) => {
          const specId = specIdByName[name];
          if (!specId) return;
          const row = await addSpecializationToProfile(specId).catch(() => null);
          if (row) specRowIds[name] = row.id;
        }),
        ...removedSpecs.map(async (name) => {
          const rowId = specRowIdByName[name];
          if (rowId) await removeSpecializationFromProfile(rowId).catch(() => {});
          delete specRowIds[name];
        }),
      ]);
      setSpecRowIdByName(specRowIds);

      // Refresh the shared cache so the preview and navbar reflect the save.
      queryClient.setQueryData(profileQueryKey, updated);
      setCommitted((c) => ({
        ...c,
        firstNameEn, lastNameEn, firstNameAr, lastNameAr,
        bio, experience, location, skills, specializations,
      }));
    } catch (err) {
      setProfileError(getApiErrorMessage(err, t('signup.errorGeneric')));
    } finally {
      setProfileSaving(false);
    }
  }

  // Runs the pending confirm action, then closes the modal.
  function handleConfirm() {
    const action = confirmState?.onConfirm;
    setConfirmState(null);
    action?.();
  }

  // Preview name follows the active language (Arabic names on the AR UI).
  const previewName = (i18n.language === 'ar'
    ? [committed.firstNameAr, committed.lastNameAr]
    : [committed.firstNameEn, committed.lastNameEn]
  ).filter(Boolean).join(' ');
  // The Selects store raw value codes — resolve the committed ones to labels.
  const locationLabel = cityOptions.find((o) => o.value === committed.location)?.label || '';
  const experienceLabel = EXPERIENCE_OPTIONS.find((o) => o.value === committed.experience)?.label || '';

  return {
    // fields
    nameGroups,
    clearNameError,
    nameFieldError,
    bio, setBio,
    experience, setExperience,
    location, setLocation,
    cityOptions,
    skills, setSkills, handleSkillQuery,
    specializations, setSpecializations, specializationOptions,
    // save
    requestProfileUpdate, profileSaving, profileError,
    // confirm modal
    confirmState, handleConfirm, cancelConfirm: () => setConfirmState(null),
    // preview
    committed, previewName, locationLabel, experienceLabel,
  };
}
