import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/shared/components/Button';
import { canFinalize, signatureLabel, stageOf } from '@/features/meetings/lib/requestStatus';
import { getUserProfile } from '@/features/identity/services/authService';
import { formatExperience } from '@/shared/lib/experience';
import { timeAgo } from '@/shared/lib/relativeTime';
import Calendar from '@/assets/icons/calendar.svg?react';
import MapPin from '@/assets/icons/map-pin.svg?react';
import ChevronDown from '@/assets/icons/chevron-down.svg?react';
import './RequestCard.css';

// One incoming join request: the applicant, their proposed slot, and the
// owner's actions for the request's current stage.
export default function RequestCard({ request: r, now, actioningId, onAccept, onReject, onFinalize }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';
  const isAr = i18n.language === 'ar';

  // The applicant's rich data (avatar, specialization, bio, skills…) lives on
  // their public profile — loaded on mount and revealed by "View profile".
  const [profile, setProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const applicantId = r.requester?.id;
    if (!applicantId) {
      setProfileLoading(false);
      return;
    }
    let alive = true;
    getUserProfile(applicantId)
      .then((data) => alive && setProfile(data))
      .catch(() => alive && setProfile(null))
      .finally(() => alive && setProfileLoading(false));
    return () => { alive = false; };
  }, [r.requester?.id]);

  const requesterName = r.requester ? (isAr ? r.requester.name_ar : r.requester.name_en) : '—';
  const requesterLocation = r.requester ? (isAr ? r.requester.location_ar : r.requester.location_en) : '';
  const avatarUrl = profile?.avatar_url || null;
  const specName = profile?.specializations?.length ? profile.specializations.join('، ') : '';

  const start = new Date(r.proposed_start_time);
  const end = new Date(r.proposed_end_time);
  const day = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(start);
  const time = (d) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d);
  const slotLabel = `${day} · ${time(start)} – ${time(end)}`;

  const busy = actioningId === r.id;

  return (
    <li className="jr__req">
      <span className="jr__avatar" aria-hidden="true">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="jr__avatar-img" />
        ) : (
          requesterName.trim().charAt(0).toUpperCase()
        )}
      </span>

      <div className="jr__req-info">
        <p className="jr__req-name">{requesterName}</p>
        {specName && <p className="jr__req-role">{specName}</p>}
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
        {r.message && (
          <>
            <p className="jr__msg-label">{t('joinRequests.message')}</p>
            <p className="jr__msg">{r.message}</p>
          </>
        )}
        <button
          type="button"
          className="jr__view-profile"
          onClick={() => setProfileOpen((v) => !v)}
          aria-expanded={profileOpen}
          disabled={!r.requester?.id}
        >
          {profileOpen ? t('joinRequests.hideProfile') : t('joinRequests.viewProfile')}
          <ChevronDown
            width={16}
            height={16}
            className={`jr__view-chev${profileOpen ? ' jr__view-chev--up' : ''}`}
            aria-hidden="true"
          />
        </button>
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

      {/* Full-width applicant profile — expands smoothly (grid-rows 0fr→1fr). */}
      <div className={`jr__profile-exp${profileOpen ? ' jr__profile-exp--open' : ''}`}>
        <div className="jr__profile-exp-inner">
          {profileLoading ? (
            <p className="jr__profile-state">{t('joinRequests.loadingProfile')}</p>
          ) : profile ? (
            <div className="jr__profile">
              {profile.years_of_experience && (
                <div className="jr__profile-field">
                  <span className="jr__profile-label">{t('joinRequests.experience')}</span>
                  <span className="jr__profile-value">
                    {formatExperience(profile.years_of_experience, t)}
                  </span>
                </div>
              )}
              {profile.bio && (
                <div className="jr__profile-field">
                  <span className="jr__profile-label">{t('joinRequests.bio')}</span>
                  <p className="jr__profile-bio">{profile.bio}</p>
                </div>
              )}
              {profile.skills?.length > 0 && (
                <div className="jr__profile-field">
                  <span className="jr__profile-label">{t('joinRequests.skills')}</span>
                  <div className="jr__skill-chips">
                    {profile.skills.map((s) => (
                      <span key={s} className="jr__skill-chip">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
