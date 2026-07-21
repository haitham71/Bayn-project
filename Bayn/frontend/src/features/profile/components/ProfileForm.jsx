import { useTranslation } from 'react-i18next';
import Input from '@/shared/components/Input';
import Button from '@/shared/components/Button';
import Select from '@/shared/components/Select';
import SkillsInput from '@/shared/components/SkillsInput';
import { BIO_MAX, EXPERIENCE_OPTIONS } from '../lib/constants';
import './ProfileForm.css';

// The editable profile form (left card). Driven entirely by the useProfileForm
// controller passed in as `form`.
export default function ProfileForm({ form }) {
  const { t } = useTranslation();

  return (
    <section className="myp__card myp__form">
      <h1 className="myp__card-title">{t('myProfile.title')}</h1>

      <div className="myp__panel" role="tabpanel">
        {form.nameGroups.map((group) => (
          <div key={group.lng} className="myp__names-group">
            <p className="myp__names-lang">{group.heading}</p>
            <div className="myp__grid">
              {group.fields.map((f) => (
                <Input
                  key={f.key}
                  label={t(`signup.${f.label}`)}
                  value={f.value}
                  onChange={(e) => { f.set(e.target.value); form.clearNameError(f.key); }}
                  disabled
                  className="myp__input"
                  {...form.nameFieldError(f.key)}
                />
              ))}
            </div>
          </div>
        ))}

        <SkillsInput
          label={t('profile.specializations')}
          value={form.specializations}
          onChange={form.setSpecializations}
          options={form.specializationOptions}
          max={1}
          removeLabelKey="profile.removeSpecialization"
          removeLabelParam="specialization"
          className="myp__input--full"
        />

        <Input
          label={t('profile.bio')}
          multiline
          rows={4}
          maxLength={BIO_MAX}
          value={form.bio}
          onChange={(e) => form.setBio(e.target.value)}
          supportingText={`${form.bio.length}/${BIO_MAX}`}
          className="myp__input myp__input--full myp__bio"
        />

        <div className="myp__grid">
          <Select
            label={t('profile.experience')}
            value={form.experience}
            onChange={form.setExperience}
            options={EXPERIENCE_OPTIONS}
            className="myp__input"
          />
          <Select
            label={t('profile.location')}
            value={form.location}
            onChange={form.setLocation}
            options={form.cityOptions}
            className="myp__input"
          />
        </div>

        <SkillsInput
          label={t('profile.skills')}
          value={form.skills}
          onChange={form.setSkills}
          onQuery={form.handleSkillQuery}
          max={7}
          className="myp__input--full"
        />

        {form.profileError && <p className="myp__form-error">{form.profileError}</p>}

        <Button
          type="button"
          variant="primary"
          size="sm"
          className="myp__submit"
          onClick={form.requestProfileUpdate}
          disabled={form.profileSaving}
        >
          {t('myProfile.confirmProfileUpdate')}
        </Button>
      </div>
    </section>
  );
}
