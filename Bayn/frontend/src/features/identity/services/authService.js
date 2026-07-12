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

// Signup logs the user straight in — the response carries the tokens + user.
export async function signup(form) {
  const phoneCountryId = await getSaudiCountryId();
  const { data } = await api.post(API.auth.signup, toSignupPayload(form, phoneCountryId));
  setTokens(data);
  return data;
}

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
