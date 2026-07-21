// Turns a backend ExperienceRange value ("less_than_1", "1-2", … "10+") into a
// localized label. Shared by any card that shows a user's years of experience.
export function formatExperience(value, t) {
  if (!value) return '';
  return value === 'less_than_1'
    ? t('experienceRange.lessThan1')
    : t('experienceRange.years', { range: value });
}
