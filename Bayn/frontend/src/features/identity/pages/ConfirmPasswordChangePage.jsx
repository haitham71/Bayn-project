import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLangNavigate } from '@/shared/hooks/useLang';
import { useTranslation } from 'react-i18next';
import IdentityLayout from '@/layouts/IdentityLayout';
import Button from '@/shared/components/Button';
import { confirmPasswordChange } from '../services/authService';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import './ConfirmPasswordChangePage.css';

// Landing page for the link emailed by the password-change flow. The token in
// the URL is the proof of identity; confirming applies the pending password.
export default function ConfirmPasswordChangePage() {
  const { t } = useTranslation();
  const navigate = useLangNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  // 'idle' | 'loading' | 'success' | 'error'
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  async function handleConfirm() {
    setStatus('loading');
    try {
      const res = await confirmPasswordChange(token);
      setMessage(res?.message || t('confirmChange.success'));
      setStatus('success');
    } catch (err) {
      setMessage(getApiErrorMessage(err, t('confirmChange.error')));
      setStatus('error');
    }
  }

  return (
    <IdentityLayout>
      <div className="cpc">
        <h2 className="cpc__title">{t('confirmChange.title')}</h2>

        {!token ? (
          <p className="cpc__message cpc__message--error">{t('confirmChange.invalidLink')}</p>
        ) : status === 'success' ? (
          <>
            <p className="cpc__message cpc__message--success">{message}</p>
            <Button variant="primary" size="lg" className="cpc__btn" onClick={() => navigate('/login')}>
              {t('confirmChange.goToLogin')}
            </Button>
          </>
        ) : (
          <>
            <p className="cpc__message">{t('confirmChange.prompt')}</p>
            {status === 'error' && <p className="cpc__message cpc__message--error">{message}</p>}
            <Button
              variant="primary"
              size="lg"
              className="cpc__btn"
              onClick={handleConfirm}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? t('confirmChange.loading') : t('confirmChange.confirmBtn')}
            </Button>
          </>
        )}
      </div>
    </IdentityLayout>
  );
}
