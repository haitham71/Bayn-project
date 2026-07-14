import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import IdentityLayout from '@/layouts/IdentityLayout';
import Button from '@/shared/components/Button';
import Input from '@/shared/components/Input';
import { forgotPassword } from '../services/authService';
import { validateEmail } from '../utils/validation';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import './ForgotPasswordPage.css';

// Step 1 of the reset flow: the user enters their email and the backend emails
// a link to the reset page. The success message is intentionally generic so it
// never reveals whether an email is registered.
export default function ForgotPasswordPage({ onNavigate }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    // Catch a bad email here so the user sees a localized message instead of
    // the backend's raw validation error.
    const emailErr = validateEmail(email);
    if (emailErr) {
      setError(t(`signup.${emailErr}`));
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(getApiErrorMessage(err, t('signup.errorGeneric')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <IdentityLayout>
      <div className="fp">
        <h2 className="fp__title">{t('forgotPassword.title')}</h2>

        {sent ? (
          <>
            <p className="fp__message fp__message--success">{t('forgotPassword.sent')}</p>
            <Button variant="primary" size="lg" className="fp__submit" onClick={() => onNavigate('login')}>
              {t('forgotPassword.backToLogin')}
            </Button>
          </>
        ) : (
          <form className="fp__form" onSubmit={handleSubmit} noValidate>
            <p className="fp__message">{t('forgotPassword.prompt')}</p>

            <Input
              label={t('login.email')}
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              className="fp__input"
            />

            {error && <p className="fp__error">{error}</p>}

            <Button type="submit" variant="primary" size="lg" className="fp__submit" disabled={loading}>
              {loading ? t('forgotPassword.sending') : t('forgotPassword.submit')}
            </Button>

            <button type="button" className="fp__link" onClick={() => onNavigate('login')}>
              {t('forgotPassword.backToLogin')}
            </button>
          </form>
        )}
      </div>
    </IdentityLayout>
  );
}
