// Small store for the JWT access/refresh tokens the API returns on signup/login.
// Kept in localStorage so a page refresh stays authenticated.

const ACCESS_KEY = 'bayn-access-token';
const REFRESH_KEY = 'bayn-refresh-token';

export function getAccessToken() {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setTokens({ access_token, refresh_token } = {}) {
  try {
    if (access_token) localStorage.setItem(ACCESS_KEY, access_token);
    if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
  } catch {
    // storage unavailable (private mode) — ignore
  }
}

export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    // ignore
  }
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}
