import { useTranslation } from 'react-i18next';
import './PasswordStrength.css';

// Same rule set the sign-up validator enforces: 8+ chars, an uppercase letter,
// a digit, and one of the allowed special characters.
export function passwordChecks(pw) {
  return [
    pw.length >= 8,
    /[A-Z]/.test(pw),
    /[0-9]/.test(pw),
    /[#$@]/.test(pw),
  ];
}

export function passwordScore(pw) {
  return passwordChecks(pw).filter(Boolean).length;
}

// Strength meter + per-rule checklist. Labels come from the shared `signup`
// namespace so the copy stays consistent wherever a password is set.
export default function PasswordStrength({ password }) {
  const { t } = useTranslation();
  const checks = passwordChecks(password);
  const score = checks.filter(Boolean).length;
  const rules = t('signup.rules', { returnObjects: true });

  return (
    <div className="pw-str">
      <div className="pw-str__header">
        <span className="pw-str__title">{t('signup.strengthLabel')}</span>
        <div className="pw-str__bars">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`pw-str__bar${i < score ? ' pw-str__bar--on' : ''}`} />
          ))}
        </div>
      </div>
      <ul className="pw-str__list">
        {rules.map((rule, i) => (
          <li key={i} className={`pw-str__rule${checks[i] ? ' pw-str__rule--ok' : ''}`}>
            {rule}
          </li>
        ))}
      </ul>
    </div>
  );
}
