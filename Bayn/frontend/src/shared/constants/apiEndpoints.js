// Central list of backend endpoint paths (relative to the API base URL).
// Keeping them here means a route change is a one-line edit.

export const API = {
  auth: {
    signup: '/auth/signup',
    signupVerifyEmail: '/auth/signup/verify-email',
    signupVerifyPhone: '/auth/signup/verify-phone',
    signupResendEmail: '/auth/signup/resend-email',
    signupResendPhone: '/auth/signup/resend-phone',
    login: '/auth/login',
    refresh: '/auth/refresh',
    profile: '/auth/profile',
    sendEmailOtp: '/auth/verify-email/send',
    confirmEmailOtp: '/auth/verify-email/confirm',
    sendPhoneOtp: '/auth/verify-phone/send',
    confirmPhoneOtp: '/auth/verify-phone/confirm',
  },
  catalog: {
    countries: '/catalog/countries',
    cities: '/catalog/cities',
    industries: '/catalog/industries',
    skillsSearch: '/catalog/skills/search',
  },
  profile: {
    skills: '/profile/skills',
    specializations: '/profile/specializations',
  },
};
