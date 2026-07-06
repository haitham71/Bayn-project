import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AuthLayout from '@/layouts/AuthLayout';
import Stepper from '../components/Stepper';
import OtpInput from '../components/OtpInput';
import Radio from '@/shared/components/Radio';
import Button from '@/shared/components/Button';
import Check from '@/assets/icons/check.svg?react';
import useCountdown from '../hooks/useCountdown';
import './VerificationPage.css';

const CHANNELS = ['email', 'phone'];

export default function VerificationPage({
  email = 'user@email.com',
  phone = '+966 5X XXX XXXX',
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [active, setActive] = useState('email');
  const [verified, setVerified] = useState({ email: false, phone: false });
  const [phase, setPhase] = useState('input'); // input | loading | success
  const { formatted, isDone, reset } = useCountdown(32);

  const steps = [
    { key: 'account', label: t('steps.account') },
    { key: 'verification', label: t('steps.verification') },
    { key: 'profile', label: t('steps.profile') },
  ];

  const destination = active === 'email' ? email : phone;

  // Sequence: loading -> success check (radio ticks) -> advance email to
  // the phone step. The error phase/shake stays wired for real backend
  // validation (setPhase('error') on a rejected code).
  function handleComplete() {
    setPhase('loading');
    setTimeout(() => {
      setPhase('success');
      setVerified((prev) => ({ ...prev, [active]: true }));
      setTimeout(() => {
        if (active === 'email') {
          setActive('phone');
          setCode('');
          reset();
          setPhase('input');
        }
      }, 900);
    }, 800);
  }

  return (
    <AuthLayout>
      <div className="verify">
        <h1 className="verify__title">{t('auth.createAccount')}</h1>

        <Stepper steps={steps} current={1} />

        <h2 className="verify__subtitle">{t('verification.title')}</h2>

        <div className={`verify__otp verify__otp--${phase}`}>
          <OtpInput
            length={4}
            value={code}
            onChange={setCode}
            onComplete={handleComplete}
            disabled={phase === 'loading' || phase === 'success'}
            error={phase === 'error'}
          />
          {phase === 'success' && (
            <span className="verify__check" aria-hidden="true">
              <Check width={30} height={30} />
            </span>
          )}
        </div>

        <p className="verify__sent">{t('verification.sentTo')}</p>
        <span className="verify__destination">{destination}</span>

        <div className="verify__resend">
          <span>{t('verification.didntReceive')}</span>
          <Button variant="tertiary" size="sm" disabled={!isDone} onClick={() => reset()}>
            {t('verification.resend')}
          </Button>
          {!isDone && <span className="verify__timer">({formatted})</span>}
        </div>

        <div className="verify__methods">
          {CHANNELS.map((key) => {
            const classes = [
              'verify__method',
              active === key && 'verify__method--active',
              verified[key] && 'verify__method--verified',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div key={key} className={classes}>
                <Radio checked={verified[key]} onChange={() => {}} tabIndex={-1} />
                <span className="verify__method-body">
                  <span className="verify__method-title">{t(`verification.${key}Option`)}</span>
                  <span className="verify__method-desc">{t(`verification.${key}OptionDesc`)}</span>
                </span>
              </div>
            );
          })}
        </div>

        <p className="verify__note">{t('verification.bothRequired')}</p>

        <Button
          variant="primary"
          size="lg"
          trailingIcon
          className="verify__next"
          disabled={!verified.email || !verified.phone}
        >
          {t('verification.nextStep')}
        </Button>
      </div>
    </AuthLayout>
  );
}
