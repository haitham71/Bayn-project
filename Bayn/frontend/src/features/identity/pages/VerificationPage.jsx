import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AuthLayout from '@/layouts/AuthLayout';
import Stepper from '../components/Stepper';
import OtpInput from '../components/OtpInput';
import Button from '@/shared/components/Button';
import useCountdown from '../hooks/useCountdown';
import './VerificationPage.css';

const METHODS = ['email', 'phone'];

export default function VerificationPage({ destination = 'user@email.com' }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [method, setMethod] = useState('email');
  const { formatted, isDone, reset } = useCountdown(32);

  const steps = [
    { key: 'account', label: t('steps.account') },
    { key: 'verification', label: t('steps.verification') },
    { key: 'profile', label: t('steps.profile') },
  ];

  return (
    <AuthLayout>
      <div className="verify">
        <h1 className="verify__title">{t('auth.createAccount')}</h1>

        <Stepper steps={steps} current={1} />

        <h2 className="verify__subtitle">{t('verification.title')}</h2>

        <OtpInput length={4} value={code} onChange={setCode} />

        <p className="verify__sent">
          {t('verification.sentTo')}
        </p>
        <span className="verify__destination">{destination}</span>

        <div className="verify__resend">
          <span>{t('verification.didntReceive')}</span>
          <Button
            variant="tertiary"
            size="sm"
            disabled={!isDone}
            onClick={() => reset()}
          >
            {t('verification.resend')}
          </Button>
          {!isDone && <span className="verify__timer">({formatted})</span>}
        </div>

        <div className="verify__methods">
          {METHODS.map((key) => {
            const selected = method === key;
            return (
              <button
                key={key}
                type="button"
                className={`verify__method${selected ? ' verify__method--selected' : ''}`}
                onClick={() => setMethod(key)}
                aria-pressed={selected}
              >
                <span className="verify__radio" aria-hidden="true" />
                <span className="verify__method-body">
                  <span className="verify__method-title">{t(`verification.${key}Option`)}</span>
                  <span className="verify__method-desc">{t(`verification.${key}OptionDesc`)}</span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="verify__note">{t('verification.bothRequired')}</p>

        <Button variant="primary" size="lg" trailingIcon className="verify__next">
          {t('verification.nextStep')}
        </Button>
      </div>
    </AuthLayout>
  );
}
