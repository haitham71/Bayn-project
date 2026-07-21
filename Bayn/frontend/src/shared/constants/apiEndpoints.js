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
    avatar: '/auth/profile/avatar',
    sendEmailOtp: '/auth/verify-email/send',
    confirmEmailOtp: '/auth/verify-email/confirm',
    sendPhoneOtp: '/auth/verify-phone/send',
    confirmPhoneOtp: '/auth/verify-phone/confirm',
    passwordForgot: '/auth/password/forgot',
    passwordReset: '/auth/password/reset',
    passwordChangeRequest: '/auth/password/change/request',
    passwordChangeConfirm: '/auth/password/change/confirm',
  },
  catalog: {
    countries: '/catalog/countries',
    cities: '/catalog/cities',
    industries: '/catalog/industries',
    specializations: '/catalog/specializations',
    skillsSearch: '/catalog/skills/search',
  },
  profile: {
    skills: '/profile/skills',
    specializations: '/profile/specializations',
  },
  projects: {
    base: '/projects',
    mine: '/projects/me',
  },
  tasks: {
    // Flat resource — project scoping is a query param, not a nested path.
    base: '/tasks',
  },
  meetings: {
    base: '/meetings',
    requests: '/meetings/requests',
    joinRequests: '/meetings/join-requests',
    team: '/meetings/team',
  },
};
