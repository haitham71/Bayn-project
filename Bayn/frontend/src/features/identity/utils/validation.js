// Pure field validators for the sign-up form. Each returns an i18n error key
// (under the `signup` namespace) when the value is invalid, or null when it is
// valid. Keeping these framework-free lets the same rules back the API layer
// later without dragging translation state through them.

// ASCII local part, a real domain, and a letters-only TLD (2+). This rejects
// numeric-only domains like "11@11.11", stray symbols, and non-Latin scripts.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
// Real names: Arabic or English letters only, single spaces between words.
// The Arabic range is limited to letters (excludes Arabic-Indic digits).
const NAME_RE = /^[A-Za-zء-ي]+(?: [A-Za-zء-ي]+)*$/;
// Usernames may only hold letters, digits, dot and underscore.
const USERNAME_ALLOWED_RE = /^[a-zA-Z0-9._]+$/;

export function validateEmail(value) {
  const v = value.trim();
  if (!v) return 'errRequired';
  return EMAIL_RE.test(v) ? null : 'errEmail';
}

export function validateName(value, { required = true } = {}) {
  const v = value.trim();
  if (!v) return required ? 'errRequired' : null;
  return NAME_RE.test(v) ? null : 'errName';
}

export function validateUsername(value) {
  const v = value.trim();
  if (!v) return 'errRequired';
  if (v.length > 20) return 'errUsername';
  if (v.startsWith('.') || v.endsWith('.') || v.includes('..')) return 'errUsername';
  if (!USERNAME_ALLOWED_RE.test(v)) return 'errUsername';
  // Must contain at least 4 Latin letters (a–z).
  if ((v.match(/[a-zA-Z]/g) || []).length < 4) return 'errUsername';
  return null;
}

export function validateDob(value) {
  const v = value.trim();
  if (!v) return 'errRequired';
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return 'errDobFormat';

  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  // Days 01–31, months 01–12.
  if (day < 1 || day > 31 || month < 1 || month > 12) return 'errDobFormat';
  const date = new Date(year, month - 1, day);
  // Reject impossible dates like 31/02/2000 (JS would roll them over).
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return 'errDobFormat';
  }

  const today = new Date();
  let age = today.getFullYear() - year;
  const beforeBirthday =
    today.getMonth() < month - 1 ||
    (today.getMonth() === month - 1 && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  if (age < 18) return 'errAge';

  return null;
}

export function validatePhone(value) {
  const v = value.replace(/\s/g, '');
  if (!v || v === '+966') return 'errRequired';
  return /^\+966\d{9}$/.test(v) ? null : 'errPhone';
}

export function validatePassword(value) {
  if (!value) return 'errRequired';
  const ok =
    value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[#$@]/.test(value);
  return ok ? null : 'errPassword';
}

// Formats raw keystrokes into a DD/MM/YYYY mask as the user types, auto-padding
// a day > 3 (e.g. 4 -> 04) or a month > 1 (e.g. 4 -> 04) so single-digit
// day/month values gain their leading zero automatically.
export function formatDob(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  let i = 0;
  let day = '';
  let month = '';
  let year = '';

  if (i < digits.length) {
    if (Number(digits[i]) > 3) {
      day = `0${digits[i]}`;
      i += 1;
    } else {
      day = digits.slice(i, i + 2);
      i += day.length;
    }
  }
  if (day.length === 2 && i < digits.length) {
    if (Number(digits[i]) > 1) {
      month = `0${digits[i]}`;
      i += 1;
    } else {
      month = digits.slice(i, i + 2);
      i += month.length;
    }
  }
  if (month.length === 2 && i < digits.length) {
    year = digits.slice(i, i + 4);
  }

  // Join only the parts that exist so there is never a trailing "/" left
  // dangling (which would otherwise block backspace).
  return [day, month, year].filter(Boolean).join('/');
}

// Keeps the fixed +966 prefix intact and allows up to 9 digits after it.
// Deleting into the prefix just clears the number rather than corrupting it.
export function formatPhone(value) {
  let digits = value.replace(/\D/g, '');
  digits = digits.startsWith('966') ? digits.slice(3) : '';
  return `+966${digits.slice(0, 9)}`;
}
