import { useTranslation } from 'react-i18next';
import Button from '@/shared/components/Button';
import { canFinalize, signatureLabel, stageOf } from '@/features/meetings/lib/requestStatus';
import { timeAgo } from '@/shared/lib/relativeTime';
import Calendar from '@/assets/icons/calendar.svg?react';
import MapPin from '@/assets/icons/map-pin.svg?react';
import './RequestCard.css';

// One incoming join request: the applicant, their proposed slot, and the
// owner's actions for the request's current stage.
export default function RequestCard({ request: r, now, actioningId, onAccept, onReject, onFinalize }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';
  const isAr = i18n.language === 'ar';

  const requesterName = r.requester ? (isAr ? r.requester.name_ar : r.requester.name_en) : '—';
  const requesterLocation = r.requester ? (isAr ? r.requester.location_ar : r.requester.location_en) : '';

  const start = new Date(r.proposed_start_time);
  const end = new Date(r.proposed_end_time);
  const day = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(start);
  const time = (d) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d);
  const slotLabel = `${day} · ${time(start)} – ${time(end)}`;

  const busy = actioningId === r.id;

  return (
    <li className="jr__req">
      <span className="jr__avatar" aria-hidden="true">
        {requesterName.trim().charAt(0).toUpperCase()}
      </span>

      <div className="jr__req-info">
        <p className="jr__req-name">{requesterName}</p>
        {r.requester?.job_title && <p className="jr__req-role">{r.requester.job_title}</p>}
        {requesterLocation && (
          <p className="jr__req-loc">
            <MapPin width={14} height={14} aria-hidden="true" />
            {requesterLocation}
          </p>
        )}
        <p className="jr__req-slot">
          <Calendar width={14} height={14} aria-hidden="true" />
          {slotLabel}
        </p>
        <p className="jr__req-applied">
          {t('joinRequests.applied', { when: timeAgo(r.created_at, locale) })}
        </p>
      </div>

      <div className="jr__req-body">
        {r.requester?.skills?.length > 0 && (
          <div className="jr__req-skills">
            <p className="jr__msg-label">{t('joinRequests.skills')}</p>
            <div className="jr__skill-chips">
              {r.requester.skills.map((s) => (
                <span key={s} className="jr__skill-chip">{s}</span>
              ))}
            </div>
          </div>
        )}
        {r.message && (
          <>
            <p className="jr__msg-label">{t('joinRequests.message')}</p>
            <p className="jr__msg">{r.message}</p>
          </>
        )}
      </div>

      <div className="jr__req-actions">
        {r.status === 'pending' && (
          <>
            <Button variant="primary" size="sm" onClick={() => onAccept(r.id)} disabled={busy}>
              {t('joinRequests.accept')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onReject(r.id)} disabled={busy}>
              {t('joinRequests.reject')}
            </Button>
          </>
        )}

        {stageOf(r) === 'signing' && (
          <p className="jr__req-state">
            {t(`joinRequests.signature.${signatureLabel(r) || 'waitingOnRequester'}`)}
          </p>
        )}

        {/* Nothing to decide until they've actually met. */}
        {stageOf(r) === 'meeting' && !canFinalize(r, now) && (
          <p className="jr__req-state">{t('joinRequests.meetingScheduled')}</p>
        )}

        {canFinalize(r, now) && (
          <>
            <p className="jr__req-state">{t('joinRequests.decidePrompt')}</p>
            <Button variant="primary" size="sm" onClick={() => onFinalize(r.id, true)} disabled={busy}>
              {t('joinRequests.approve')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onFinalize(r.id, false)} disabled={busy}>
              {t('joinRequests.decline')}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
