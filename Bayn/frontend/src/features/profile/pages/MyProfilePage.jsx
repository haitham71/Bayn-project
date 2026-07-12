import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getProfile, getSaudiCountryId, getCities, searchSkills } from '@/features/identity/services/authService';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Input from '@/shared/components/Input';
import Button from '@/shared/components/Button';
import Select from '@/shared/components/Select';
import SkillsInput from '@/shared/components/SkillsInput';
import PasswordStrength from '@/shared/components/PasswordStrength';
import { validateName, validateUsername, validatePassword } from '@/features/identity/utils/validation';
import Camera from '@/assets/icons/camera.svg?react';
import MapPin from '@/assets/icons/map-pin.svg?react';
import Eye from '@/assets/icons/eye.svg?react';
import EyeOff from '@/assets/icons/eye-off.svg?react';
import './MyProfilePage.css';

const BIO_MAX = 200;

const TABS = [
  { key: 'account', labelKey: 'myProfile.tabAccount' },
  { key: 'profile', labelKey: 'myProfile.tabProfile' },
];

// Values match the backend's ExperienceRange enum exactly.
const EXPERIENCE_OPTIONS = [
  { value: 'less_than_1', label: 'Less than 1 Year' },
  { value: '1-2', label: '1-2 Years' },
  { value: '2-3', label: '2-3 Years' },
  { value: '3-4', label: '3-4 Years' },
  { value: '5-10', label: '5-10 Years' },
  { value: '10+', label: '10+ Years' },
];

// Seed values (stand-in for the account fetched from the API). Both the form
// fields and the initial preview snapshot start from here.
const SEED = {
  username: 'assad.dev',
  firstNameEn: 'Assad', secondNameEn: 'Saad', thirdNameEn: '', lastNameEn: 'Al-saeed',
  firstNameAr: 'أسعد', secondNameAr: 'سعد', thirdNameAr: '', lastNameAr: 'السعيد',
  shortTitle: 'Software Engineer',
  bio: 'Experienced in software development and passionate about building innovative solutions. I enjoy collaborating with ambitious teams to create impactful products.',
  experience: '2-3 Years',
  location: 'Riyadh, Saudi Arabia',
  skills: ['React', 'Node js', 'Python', 'Mysql', 'Java Script'],
};

// The subset of fields the Profile View reflects.
function previewSnapshot(s) {
  return {
    username: s.username,
    firstNameEn: s.firstNameEn, lastNameEn: s.lastNameEn,
    firstNameAr: s.firstNameAr, lastNameAr: s.lastNameAr,
    shortTitle: s.shortTitle, bio: s.bio,
    experience: s.experience, location: s.location, skills: s.skills,
  };
}

// Small trailing eye toggle shared by the password fields.
function eyeToggle(shown) {
  return shown
    ? <Eye width={20} height={20} aria-hidden="true" />
    : <EyeOff width={20} height={20} aria-hidden="true" />;
}

export default function MyProfilePage({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('account');

  // --- Account information ---
  const [username, setUsername] = useState(SEED.username);
  const [email] = useState('user@email.com');
  const [phone] = useState('+966 501 34567');
  const [accountErrors, setAccountErrors] = useState({});
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwErrors, setPwErrors] = useState({});

  // --- Profile information (four-part name in both languages) ---
  // Names, experience and location load from the backend on mount.
  const [firstNameEn, setFirstNameEn] = useState('');
  const [secondNameEn, setSecondNameEn] = useState('');
  const [thirdNameEn, setThirdNameEn] = useState('');
  const [lastNameEn, setLastNameEn] = useState('');
  const [firstNameAr, setFirstNameAr] = useState('');
  const [secondNameAr, setSecondNameAr] = useState('');
  const [thirdNameAr, setThirdNameAr] = useState('');
  const [lastNameAr, setLastNameAr] = useState('');
  const [shortTitle, setShortTitle] = useState('Software Engineer');
  const [bio, setBio] = useState(SEED.bio);
  const [experience, setExperience] = useState('');
  const [location, setLocation] = useState('');
  const [skills, setSkills] = useState(SEED.skills);
  const [cityOptions, setCityOptions] = useState([]);
  const [nameErrors, setNameErrors] = useState({});

  // Built up as skill search results come in — resolves a chosen skill name
  // back to the skill_id the backend needs when it's actually saved.
  const [skillIdByName, setSkillIdByName] = useState({});

  // Values shown in the Profile View — updated only when changes are confirmed
  // (the mount effect below seeds it with the loaded profile).
  const [committed, setCommitted] = useState(() => previewSnapshot({
    ...SEED,
    firstNameEn: '', lastNameEn: '', firstNameAr: '', lastNameAr: '',
    experience: '', location: '',
  }));

  async function handleSkillQuery(q) {
    const results = await searchSkills(q);
    setSkillIdByName((prev) => {
      const next = { ...prev };
      results.forEach((r) => { next[r.name] = r.id; });
      return next;
    });
    return results.map((r) => r.name);
  }

  // Loads the signed-in user's real name, experience and city once, on mount —
  // and mirrors them into the preview snapshot.
  useEffect(() => {
    getProfile().then((u) => {
      setFirstNameEn(u.first_name_en || '');
      setSecondNameEn(u.second_name_en || '');
      setThirdNameEn(u.third_name_en || '');
      setLastNameEn(u.last_name_en || '');
      setFirstNameAr(u.first_name_ar || '');
      setSecondNameAr(u.second_name_ar || '');
      setThirdNameAr(u.third_name_ar || '');
      setLastNameAr(u.last_name_ar || '');
      setExperience(u.years_of_experience || '');
      setLocation(u.city_id || '');
      setCommitted((c) => ({
        ...c,
        firstNameEn: u.first_name_en || '',
        lastNameEn: u.last_name_en || '',
        firstNameAr: u.first_name_ar || '',
        lastNameAr: u.last_name_ar || '',
        experience: u.years_of_experience || '',
        location: u.city_id || '',
      }));
    }).catch(() => {});

    getSaudiCountryId()
      .then((saId) => (saId ? getCities(saId) : []))
      .then((cities) => setCityOptions(cities.map((c) => ({ value: c.id, label: c.name_en }))))
      .catch(() => {});
  }, []);

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


  // Confirm actions — validate, then push the values into the preview snapshot.
  function handleAccountUpdate() {
    const err = validateUsername(username);
    setAccountErrors(err ? { username: err } : {});
    if (err) return;
    setCommitted((c) => ({ ...c, username }));
    // TODO: persist username via the account API.
  }

  const accountFieldError = (field) =>
    accountErrors[field] ? { error: true, errorText: t(`signup.${accountErrors[field]}`) } : {};

  function handlePasswordChange() {
    // Same rules the sign-up form enforces, plus a current-password check
    // and a new/confirm match.
    const next = {};
    if (!currentPassword) next.current = 'errRequired';
    const pass = validatePassword(newPassword);
    if (pass) next.new = pass;
    if (!pass && confirmNewPassword !== newPassword) next.confirm = 'errorPassword';
    setPwErrors(next);
    if (Object.values(next).some(Boolean)) return;
    // TODO: submit currentPassword/newPassword to the password API.
  }

  // Clears a single password field's error once the user edits it.
  function clearPwError(field) {
    setPwErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  const pwFieldError = (field) =>
    pwErrors[field] ? { error: true, errorText: t(`signup.${pwErrors[field]}`) } : {};

  function clearNameError(field) {
    setNameErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  const nameFieldError = (field) =>
    nameErrors[field] ? { error: true, errorText: t(`signup.${nameErrors[field]}`) } : {};

  function handleProfileUpdate() {
    const next = {};
    allNameFields.forEach((f) => {
      const err = validateName(f.value, { lang: f.lang, required: f.required });
      if (err) next[f.key] = err;
    });
    setNameErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setCommitted((c) => ({
      ...c,
      firstNameEn, lastNameEn, firstNameAr, lastNameAr,
      shortTitle, bio, experience, location, skills,
    }));
    // TODO: persist the profile fields via the profile API.
  }

  // Preview name follows the active language (Arabic names on the AR UI).
  const previewName = (i18n.language === 'ar'
    ? [committed.firstNameAr, committed.lastNameAr]
    : [committed.firstNameEn, committed.lastNameEn]
  ).filter(Boolean).join(' ');
  // The Selects store raw value codes (a city id, an enum code) — resolve the
  // committed ones back to display labels for the read-only preview panel.
  const locationLabel = cityOptions.find((o) => o.value === committed.location)?.label || '';
  const experienceLabel = EXPERIENCE_OPTIONS.find((o) => o.value === committed.experience)?.label || '';

  return (
    <div className="myp bayn-scroll">
      <Sidebar activeKey="profile" onNavigate={onNavigate} />

      <div className="myp__main">
        <Navbar userName={previewName} />

        <main className="myp__body">
          {/* Editable form with tabs */}
          <section className="myp__card myp__form">
            <h1 className="myp__card-title">{t('myProfile.title')}</h1>

            <div className="myp__tabs" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  className={`myp__tab${activeTab === tab.key ? ' myp__tab--active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>

            {activeTab === 'account' && (
              <div className="myp__panel" role="tabpanel">
                <div className="myp__grid">
                  <Input
                    label={t('signup.username')}
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setAccountErrors((p) => (p.username ? {} : p));
                    }}
                    className="myp__input"
                    {...accountFieldError('username')}
                  />
                  <Input
                    label={t('signup.email')}
                    value={email}
                    disabled
                    className="myp__input"
                  />
                  <Input
                    label={t('signup.phone')}
                    value={phone}
                    disabled
                    className="myp__input"
                  />
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="myp__submit"
                  onClick={handleAccountUpdate}
                >
                  {t('myProfile.confirmAccountUpdate')}
                </Button>

                <h2 className="myp__section-title">{t('myProfile.changePassword')}</h2>

                <Input
                  label={t('myProfile.currentPassword')}
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); clearPwError('current'); }}
                  trailingIcon={eyeToggle(showCurrent)}
                  onTrailingClick={() => setShowCurrent((p) => !p)}
                  className="myp__input myp__input--full"
                  {...pwFieldError('current')}
                />

                <div className="myp__grid">
                  <Input
                    label={t('myProfile.newPassword')}
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); clearPwError('new'); }}
                    trailingIcon={eyeToggle(showNew)}
                    onTrailingClick={() => setShowNew((p) => !p)}
                    className="myp__input"
                    {...pwFieldError('new')}
                  />
                  <Input
                    label={t('myProfile.confirmNewPassword')}
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(e) => { setConfirmNewPassword(e.target.value); clearPwError('confirm'); }}
                    trailingIcon={eyeToggle(showConfirm)}
                    onTrailingClick={() => setShowConfirm((p) => !p)}
                    className="myp__input"
                    {...pwFieldError('confirm')}
                  />
                </div>

                <PasswordStrength password={newPassword} />

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="myp__submit"
                  onClick={handlePasswordChange}
                >
                  {t('myProfile.confirmPasswordChange')}
                </Button>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="myp__panel" role="tabpanel">
                {nameGroups.map((group) => (
                  <div key={group.lng} className="myp__names-group">
                    <p className="myp__names-lang">{group.heading}</p>
                    <div className="myp__grid">
                      {group.fields.map((f) => (
                        <Input
                          key={f.key}
                          label={t(`signup.${f.label}`)}
                          value={f.value}
                          onChange={(e) => { f.set(e.target.value); clearNameError(f.key); }}
                          disabled
                          className="myp__input"
                          {...nameFieldError(f.key)}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                <Input
                  label={t('profile.title')}
                  supportingText={t('profile.titleHint')}
                  value={shortTitle}
                  onChange={(e) => setShortTitle(e.target.value)}
                  className="myp__input myp__input--full"
                />

                <Input
                  label={t('profile.bio')}
                  multiline
                  rows={4}
                  maxLength={BIO_MAX}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  supportingText={`${bio.length}/${BIO_MAX}`}
                  className="myp__input myp__input--full myp__bio"
                />

                <div className="myp__grid">
                  <Select
                    label={t('profile.experience')}
                    value={experience}
                    onChange={setExperience}
                    options={EXPERIENCE_OPTIONS}
                    className="myp__input"
                  />
                  <Select
                    label={t('profile.location')}
                    value={location}
                    onChange={setLocation}
                    options={cityOptions}
                    className="myp__input"
                  />
                </div>

                <SkillsInput
                  label={t('profile.skills')}
                  value={skills}
                  onChange={setSkills}
                  onQuery={handleSkillQuery}
                  max={7}
                  className="myp__input--full"
                />

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="myp__submit"
                  onClick={handleProfileUpdate}
                >
                  {t('myProfile.confirmProfileUpdate')}
                </Button>
              </div>
            )}
          </section>

          {/* Read-only preview */}
          <aside className="myp__card myp__preview">
            <h2 className="myp__card-title">{t('myProfile.previewTitle')}</h2>

            <div className="myp__avatar-wrap">
              <span className="myp__avatar" aria-hidden="true">
                {previewName.trim().charAt(0).toUpperCase()}
              </span>
              <button type="button" className="myp__avatar-btn" aria-label={t('myProfile.changePhoto')}>
                <Camera width={24} height={24} aria-hidden="true" />
              </button>
            </div>

            <p className="myp__preview-name">{previewName}</p>
            <p className="myp__preview-username">{committed.username}</p>
            <p className="myp__preview-role">{committed.shortTitle}</p>
            <p className="myp__preview-location">
              <MapPin width={18} height={18} aria-hidden="true" />
              {locationLabel}
            </p>

            <hr className="myp__preview-divider" />

            <h3 className="myp__preview-heading">{t('myProfile.sectionBio')}</h3>
            <p className="myp__preview-bio">{committed.bio}</p>

            <h3 className="myp__preview-heading">{t('myProfile.sectionExperience')}</h3>
            <p className="myp__preview-exp">{experienceLabel}</p>

            <h3 className="myp__preview-heading">{t('myProfile.sectionSkills')}</h3>
            <ul className="myp__preview-skills">
              {committed.skills.map((skill) => (
                <li key={skill} className="myp__pill">{skill}</li>
              ))}
            </ul>
          </aside>
        </main>
      </div>
    </div>
  );
}
