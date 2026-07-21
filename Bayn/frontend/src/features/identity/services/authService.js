import api from '@/shared/lib/axios';
import { API } from '@/shared/constants/apiEndpoints';
import { setTokens, clearTokens } from '@/shared/lib/authToken';

// ── Catalog ─────────────────────────────────────────────────────────────────

export async function getCountries() {
  const { data } = await api.get(API.catalog.countries);
  return data;
}

// The phone is stored as a country id + local number, so resolve Saudi Arabia's
// id for the +966 numbers the sign-up form collects.
export async function getSaudiCountryId() {
  const countries = await getCountries();
  const sa = countries.find(
    (c) => c.iso2 === 'SA' || c.dial_code === '+966' || c.dial_code === '966',
  );
  return sa?.id ?? null;
}

// ── Mapping form -> backend payload ─────────────────────────────────────────

// "DD/MM/YYYY" -> "YYYY-MM-DD" (date only, matches the backend's Date field).
function toBirthDate(dob) {
  const m = (dob || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// "+966512345678" -> 512345678 (drop the country code, keep the local digits).
function toPhoneNumber(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  const local = digits.startsWith('966') ? digits.slice(3) : digits;
  return local ? Number(local) : null;
}
//check
export async function getCities(countryId) {
  const { data } = await api.get(API.catalog.cities, { params: { country_id: countryId } });
  return data;
}

export async function getIndustries() {
  const { data } = await api.get(API.catalog.industries);
  return data;
}

export async function searchSkills(query) {
  const { data } = await api.get(API.catalog.skillsSearch, { params: { q: query } });
  return data;
}

export function toSignupPayload(form, phoneCountryId) {
  const opt = (v) => (v && v.trim() ? v.trim() : null);
  return {
    first_name_ar: form.firstNameAr.trim(),
    second_name_ar: opt(form.secondNameAr),
    third_name_ar: opt(form.thirdNameAr),
    last_name_ar: form.lastNameAr.trim(),
    first_name_en: form.firstNameEn.trim(),
    second_name_en: opt(form.secondNameEn),
    third_name_en: opt(form.thirdNameEn),
    last_name_en: form.lastNameEn.trim(),
    email: form.email.trim(),
    username: form.username.trim(),
    password: form.password,
    birth_date: toBirthDate(form.dob),
    phone_country_id: phoneCountryId,
    phone_number: toPhoneNumber(form.phone),
  };
}

// ── Auth ────────────────────────────────────────────────────────────────────

// Starts a pending signup: the backend stores the data, sends the email OTP and
// returns a pending_token (no account/tokens yet — those come after the phone
// step). All OTP sending is done by the backend; the frontend only verifies.
export async function signup(form) {
  const phoneCountryId = await getSaudiCountryId();
  const { data } = await api.post(API.auth.signup, toSignupPayload(form, phoneCountryId));
  return data; // PendingSignupResponse { pending_token, message, email_verified, phone_verified }
}

// Confirms the email OTP during signup; the backend then sends the phone OTP.
export const signupVerifyEmail = (pending_token, otp_code) =>
  api.post(API.auth.signupVerifyEmail, { pending_token, otp_code }).then((r) => r.data);

// Confirms the phone OTP, which creates the account and logs the user in.
export const signupVerifyPhone = (pending_token, otp_code) =>
  api.post(API.auth.signupVerifyPhone, { pending_token, otp_code }).then((r) => {
    setTokens(r.data);
    return r.data;
  });

export const signupResendEmail = (pending_token) =>
  api.post(API.auth.signupResendEmail, { pending_token }).then((r) => r.data);

export const signupResendPhone = (pending_token) =>
  api.post(API.auth.signupResendPhone, { pending_token }).then((r) => r.data);

export async function login({ email, password }) {
  const { data } = await api.post(API.auth.login, { email, password });
  setTokens(data);
  return data;
}

export function logout() {
  clearTokens();
}

// ── OTP (require the auth token from signup) ────────────────────────────────

export const sendEmailOtp = () => api.post(API.auth.sendEmailOtp).then((r) => r.data);
export const confirmEmailOtp = (otp_code) =>
  api.post(API.auth.confirmEmailOtp, { otp_code }).then((r) => r.data);
export const sendPhoneOtp = () => api.post(API.auth.sendPhoneOtp).then((r) => r.data);
export const confirmPhoneOtp = (otp_code) =>
  api.post(API.auth.confirmPhoneOtp, { otp_code }).then((r) => r.data);

// ── Password reset (forgot flow: request emails a link, reset sets a new one) ──

export const forgotPassword = (email) =>
  api.post(API.auth.passwordForgot, { email }).then((r) => r.data);

export const resetPassword = (token, new_password) =>
  api.post(API.auth.passwordReset, { token, new_password }).then((r) => r.data);

// ── Password change (logged-in flow: request emails a link, confirm applies it) ─

export const requestPasswordChange = (current_password, new_password) =>
  api.post(API.auth.passwordChangeRequest, { current_password, new_password }).then((r) => r.data);

// The confirm endpoint takes the token as a query param, not a body.
export const confirmPasswordChange = (token) =>
  api.post(API.auth.passwordChangeConfirm, null, { params: { token } }).then((r) => r.data);

// ── Profile ─────────────────────────────────────────────────────────────────

export const getProfile = () => api.get(API.auth.profile).then((r) => r.data);
export const updateProfile = (payload) => api.patch(API.auth.profile, payload).then((r) => r.data);

// Soft-deletes the signed-in user's account (DELETE /auth/profile).
export const deleteAccount = () => api.delete(API.auth.profile).then((r) => r.data);

// Uploads the avatar as multipart/form-data and returns the updated profile
// (which carries the fresh avatar_url). Let the browser set the boundary.
export const uploadAvatar = (file) => {
  const form = new FormData();
  form.append('file', file);
  return api
    .post(API.auth.avatar, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
};

export const deleteAvatar = () => api.delete(API.auth.avatar).then((r) => r.data);
export const getMySkills = () => api.get(API.profile.skills).then((r) => r.data);
export const addSkillToProfile = (skill_id) =>
  api.post(API.profile.skills, { skill_id }).then((r) => r.data);
export const removeSkillFromProfile = (userSkillId) =>
  api.delete(`${API.profile.skills}/${userSkillId}`).then((r) => r.data);

export const getAllSpecializations = () =>
  api.get(API.catalog.specializations).then((r) => r.data);
export const getMySpecializations = () =>
  api.get(API.profile.specializations).then((r) => r.data);
export const addSpecializationToProfile = (specialization_id) =>
  api.post(API.profile.specializations, { specialization_id }).then((r) => r.data);
export const removeSpecializationFromProfile = (userSpecializationId) =>
  api.delete(`${API.profile.specializations}/${userSpecializationId}`).then((r) => r.data);
