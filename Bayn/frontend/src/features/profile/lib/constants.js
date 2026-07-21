export const BIO_MAX = 200;

// Values match the backend's ExperienceRange enum exactly.
export const EXPERIENCE_OPTIONS = [
  { value: 'less_than_1', label: 'Less than 1 Year' },
  { value: '1-2', label: '1-2 Years' },
  { value: '2-3', label: '2-3 Years' },
  { value: '3-4', label: '3-4 Years' },
  { value: '5-10', label: '5-10 Years' },
  { value: '10+', label: '10+ Years' },
];

// The Profile View starts empty and fills in from the loaded profile.
export const EMPTY_PREVIEW = {
  username: '',
  firstNameEn: '', lastNameEn: '', firstNameAr: '', lastNameAr: '',
  bio: '', experience: '', location: '', skills: [], specializations: [],
};
