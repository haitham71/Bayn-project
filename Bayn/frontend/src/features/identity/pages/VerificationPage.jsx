import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import IdentityLayout from '@/layouts/IdentityLayout';
import Stepper from '../components/Stepper';
import OtpInput from '../components/OtpInput';
import Radio from '@/shared/components/Radio';
import Button from '@/shared/components/Button';
import Check from '@/assets/icons/check.svg?react';
import useCountdown from '../hooks/useCountdown';
import {
  signupVerifyEmail,
  signupVerifyPhone,
  signupResendEmail,
  signupResendPhone,
} from '../services/authService';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import './VerificationPage.css';

const CHANNELS = ['email', 'phone'];
// Authentica's OTP length. Bump to 6 if the codes arrive as 6 digits.
const OTP_LENGTH = 4;

export default function VerificationPage({
  email = 'user@email.com',
  phone = '+966 5X XXX XXXX',
  pendingToken = '',
  onEditInfo,
  onNext,
}) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [active, setActive] = useState('email');
  const [verified, setVerified] = useState({ email: false, phone: false });
  const [phase, setPhase] = useState('input'); // input | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');
  // The pending signup is tracked by this token; the backend may rotate it on
  // each step, so we keep the latest one it returns.
  const [token, setToken] = useState(pendingToken);
  const { formatted, isDone, reset } = useCountdown(32);

  // Everything confirmed — nothing left to resend. Stop the timer so it doesn't
  // keep ticking in the background and keep the resend action disabled.
  const allVerified = verified.email && verified.phone;
  useEffect(() => {
    if (allVerified) reset(0);
  }, [allVerified, reset]);

  const steps = [
    { key: 'account', label: t('steps.account') },
    { key: 'verification', label: t('steps.verification') },
    { key: 'profile', label: t('steps.profile') },
  ];

  const destination = active === 'email' ? email : phone;

  // The backend sends every OTP itself — the email one on /signup, the phone one
  // the moment the email is confirmed. The frontend never triggers a send; it
  // only verifies the codes the user enters (and asks for a resend on request).

  async function handleComplete(entered) {
    setPhase('loading');
    setErrorMsg('');
    try {
      if (active === 'email') {
        // Confirms the email; the backend then sends the phone OTP.
        const res = await signupVerifyEmail(token, entered);
        if (res?.pending_token) setToken(res.pending_token);
      } else {
        // Confirms the phone, which creates the account and logs the user in.
        await signupVerifyPhone(token, entered);
      }

      setPhase('success');
      setVerified((prev) => ({ ...prev, [active]: true }));
      setTimeout(() => {
        if (active === 'email') {
          setActive('phone');
          setCode('');
          reset();
          setPhase('input');
        }
        // Phone was the last step — keep the success state so the check mark
        // stays and the input boxes don't reappear.
      }, 900);
    } catch (err) {
      setPhase('error');
      setErrorMsg(getApiErrorMessage(err, t('verification.invalidCode')));
      setTimeout(() => {
        setCode('');
        setPhase('input');
      }, 1500);
    }
  }

  // Ask the backend to resend the current channel's OTP (user-initiated only).
  async function handleResend() {
    setErrorMsg('');
    try {
      const res = active === 'email'
        ? await signupResendEmail(token)
        : await signupResendPhone(token);
      if (res?.pending_token) setToken(res.pending_token);
      reset();
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err, t('verification.sendFailed')));
    }
  }

  return (
    <IdentityLayout>
      <div className="verify">
        <h1 className="verify__title">{t('auth.createAccount')}</h1>

        <Stepper steps={steps} current={1} />

        <h2 className="verify__subtitle">{t('verification.title')}</h2>

        <div className={`verify__otp verify__otp--${phase}`}>
          <OtpInput
            length={OTP_LENGTH}
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

        {errorMsg && (
          <p className="verify__error" role="alert">
            {errorMsg}
          </p>
        )}

        <p className="verify__sent">{t('verification.sentTo')}</p>
        <span className="verify__destination" dir="ltr">{destination}</span>

        <div className="verify__resend">
          <span>{t('verification.didntReceive')}</span>
          <Button variant="tertiary" size="sm" disabled={!isDone || verified[active] || allVerified} onClick={handleResend}>
            {t('verification.resend')}
          </Button>
          {!isDone && !allVerified && <span className="verify__timer">({formatted})</span>}
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
          onClick={onNext}
        >
          {t('verification.nextStep')}
        </Button>

        <p className="verify__edit">
          <span>{t('verification.wrongInfo')}</span>
          <Button variant="tertiary" size="sm" onClick={onEditInfo} disabled={verified.phone}>
            {t('verification.editInfo')}
          </Button>
        </p>
      </div>
    </IdentityLayout>
  );
}
