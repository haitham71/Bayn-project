import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Input from '@/shared/components/Input';
import Button from '@/shared/components/Button';
import PasswordStrength from '@/shared/components/PasswordStrength';
import { validatePassword } from '@/features/identity/utils/validation';
import ChevronDown from '@/assets/icons/chevron-down.svg?react';
import Camera from '@/assets/icons/camera.svg?react';
import MapPin from '@/assets/icons/map-pin.svg?react';
import Eye from '@/assets/icons/eye.svg?react';
import EyeOff from '@/assets/icons/eye-off.svg?react';
import X from '@/assets/icons/x.svg?react';
import './MyProfilePage.css';

const BIO_MAX = 200;

// Maps a sidebar item key to an app page so the shared Sidebar can drive
// top-level navigation from this screen.
const SIDEBAR_ROUTES = { home: 'home', projects: 'myprojects', profile: 'myprofile' };

const TABS = [
  { key: 'account', labelKey: 'myProfile.tabAccount' },
  { key: 'profile', labelKey: 'myProfile.tabProfile' },
];

// Small trailing eye toggle shared by the password fields.
function eyeToggle(shown) {
  return shown
    ? <Eye width={20} height={20} aria-hidden="true" />
    : <EyeOff width={20} height={20} aria-hidden="true" />;
}

export default function MyProfilePage({ onNavigate }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('account');

  // --- Account information ---
  const [username, setUsername] = useState('assad.dev');
  const [email] = useState('user@email.com');
  const [phone] = useState('+966 501 34567');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwErrors, setPwErrors] = useState({});

  // --- Profile information (four-part name in both languages) ---
  const [firstNameEn, setFirstNameEn] = useState('Assad');
  const [secondNameEn, setSecondNameEn] = useState('Saad');
  const [thirdNameEn, setThirdNameEn] = useState('');
  const [lastNameEn, setLastNameEn] = useState('Al-saeed');
  const [firstNameAr, setFirstNameAr] = useState('أسعد');
  const [secondNameAr, setSecondNameAr] = useState('سعد');
  const [thirdNameAr, setThirdNameAr] = useState('');
  const [lastNameAr, setLastNameAr] = useState('السعيد');
  const [shortTitle, setShortTitle] = useState('Software Engineer');
  const [bio, setBio] = useState(
    'Experienced in software development and passionate about building innovative solutions. I enjoy collaborating with ambitious teams to create impactful products.',
  );
  const [experience, setExperience] = useState('2-3 Years');
  const [location, setLocation] = useState('Riyadh, Saudi Arabia');
  const [skills, setSkills] = useState(['React', 'Node js', 'Python', 'Mysql', 'Java Script']);
  const [skillInput, setSkillInput] = useState('');

  const nameGroups = [
    {
      lng: 'en',
      heading: t('profile.langEnglish'),
      fields: [
        { key: 'firstNameEn', label: 'firstName', value: firstNameEn, set: setFirstNameEn },
        { key: 'secondNameEn', label: 'secondName', value: secondNameEn, set: setSecondNameEn },
        { key: 'thirdNameEn', label: 'thirdName', value: thirdNameEn, set: setThirdNameEn },
        { key: 'lastNameEn', label: 'lastName', value: lastNameEn, set: setLastNameEn },
      ],
    },
    {
      lng: 'ar',
      heading: t('profile.langArabic'),
      fields: [
        { key: 'firstNameAr', label: 'firstName', value: firstNameAr, set: setFirstNameAr },
        { key: 'secondNameAr', label: 'secondName', value: secondNameAr, set: setSecondNameAr },
        { key: 'thirdNameAr', label: 'thirdName', value: thirdNameAr, set: setThirdNameAr },
        { key: 'lastNameAr', label: 'lastName', value: lastNameAr, set: setLastNameAr },
      ],
    },
  ];

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

  // Confirm actions — integration points for the backend once it's wired.
  function handleAccountUpdate() {
    // TODO: persist username via the account API.
  }

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

  function handleProfileUpdate() {
    // TODO: persist the profile fields via the profile API.
  }

  const fullName = [firstNameEn, lastNameEn].filter(Boolean).join(' ');

  return (
    <div className="myp">
      <Sidebar
        activeKey="profile"
        onNavigate={(key) => SIDEBAR_ROUTES[key] && onNavigate?.(SIDEBAR_ROUTES[key])}
      />

      <div className="myp__main">
        <Navbar userName={fullName} />

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
                    onChange={(e) => setUsername(e.target.value)}
                    className="myp__input"
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
                          onChange={(e) => f.set(e.target.value)}
                          className="myp__input"
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
                  <Input
                    label={t('profile.experience')}
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    trailingIcon={<ChevronDown width={20} height={20} aria-hidden="true" />}
                    className="myp__input"
                  />
                  <Input
                    label={t('profile.location')}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    trailingIcon={<ChevronDown width={20} height={20} aria-hidden="true" />}
                    className="myp__input"
                  />
                </div>

                <div className="myp__skills">
                  <Input
                    label={t('profile.skills')}
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={handleSkillKey}
                    onBlur={() => addSkill(skillInput)}
                    className="myp__input myp__input--full"
                  />
                  {skills.length > 0 && (
                    <ul className="myp__chips">
                      {skills.map((skill, i) => (
                        <li key={skill} className="myp__chip">
                          <span className="myp__chip-label">{skill}</span>
                          <button
                            type="button"
                            className="myp__chip-x"
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
                {fullName.trim().charAt(0).toUpperCase()}
              </span>
              <button type="button" className="myp__avatar-btn" aria-label={t('myProfile.changePhoto')}>
                <Camera width={24} height={24} aria-hidden="true" />
              </button>
            </div>

            <p className="myp__preview-name">{fullName}</p>
            <p className="myp__preview-username">{username}</p>
            <p className="myp__preview-role">{shortTitle}</p>
            <p className="myp__preview-location">
              <MapPin width={18} height={18} aria-hidden="true" />
              {location}
            </p>

            <hr className="myp__preview-divider" />

            <h3 className="myp__preview-heading">{t('myProfile.sectionBio')}</h3>
            <p className="myp__preview-bio">{bio}</p>

            <h3 className="myp__preview-heading">{t('myProfile.sectionExperience')}</h3>
            <p className="myp__preview-exp">{experience}</p>

            <h3 className="myp__preview-heading">{t('myProfile.sectionSkills')}</h3>
            <ul className="myp__preview-skills">
              {skills.map((skill) => (
                <li key={skill} className="myp__pill">{skill}</li>
              ))}
            </ul>
          </aside>
        </main>
      </div>
    </div>
  );
}
