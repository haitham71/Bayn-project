import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DescriptionView from '@/shared/components/DescriptionView';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Button from '@/shared/components/Button';
import Input from '@/shared/components/Input';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { getProject, getProjectSlots } from '@/features/projects/services/projectService';
import { createJoinRequest } from '@/features/meetings/services/meetingService';
import { getIndustries, getUserProfile, getAllSpecializations } from '@/features/identity/services/authService';
import { formatExperience } from '@/shared/lib/experience';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import ArrowLeft from '@/assets/icons/arrow-left.svg?react';
import Bookmark from '@/assets/icons/bookmark.svg?react';
import Share2 from '@/assets/icons/share-2.svg?react';
import CalendarIcon from '@/assets/icons/calendar.svg?react';
import UserCheck from '@/assets/icons/user-check.svg?react';
import Flag from '@/assets/icons/flag.svg?react';
import Briefcase from '@/assets/icons/briefcase.svg?react';
import UserRound from '@/assets/icons/user-round.svg?react';
import ChevronDown from '@/assets/icons/chevron-down.svg?react';
import SendHorizontal from '@/assets/icons/send-horizontal.svg?react';
import Send from '@/assets/icons/send.svg?react';
import FileText from '@/assets/icons/file-text.svg?react';
import MessageSquareText from '@/assets/icons/message-square-text.svg?react';
import CircleCheck from '@/assets/icons/circle-check.svg?react';
import './IdeaDetailsPage.css';

const STAGE_LABEL = {
  planning: 'createIdea.stagePlanning',
  development: 'createIdea.stageDevelopment',
  launching: 'createIdea.stageLaunching',
};

// Stricter than the API's 500-char cap on JoinRequestCreate.message.
const JOIN_NOTE_MAX = 250;

function daysSince(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export default function IdeaDetailsPage({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const { fullName } = useCurrentUser();
  const { id } = useParams();

  const [idea, setIdea] = useState(null);
  const [industries, setIndustries] = useState([]);
  const [specById, setSpecById] = useState({});
  const [slots, setSlots] = useState([]);

  // The owner card is driven entirely by the owner's public profile (loaded on
  // mount); "View profile" just expands to reveal the rest of it.
  const [profileOpen, setProfileOpen] = useState(false);
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [ownerLoading, setOwnerLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [joinNote, setJoinNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState('');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    Promise.all([
      getProject(id),
      getIndustries().catch(() => []),
      getProjectSlots(id).catch(() => []),
      getAllSpecializations().catch(() => []),
    ])
      .then(([p, inds, sl, specs]) => {
        setIdea(p);
        setIndustries(inds || []);
        setSlots(sl || []);
        setSpecById(Object.fromEntries((specs || []).map((s) => [s.id, s.name])));
        // Owner name, avatar, specialization, bio and skills all come from the
        // owner's public profile — not duplicated onto the project payload.
        if (p?.owner?.id) {
          return getUserProfile(p.owner.id)
            .then((data) => setOwnerProfile(data))
            .catch(() => setOwnerProfile(null));
        }
        return undefined;
      })
      .catch(() => setIdea(null))
      .finally(() => {
        setLoading(false);
        setOwnerLoading(false);
      });
  }, [id]);

  const industryName = idea ? (industries.find((i) => i.id === idea.industry_id)?.name || '') : '';

  // Group the per-seat team_slots into one row per required specialization:
  // seat count + its (shared) alternate. Names resolve from the catalog.
  const specName = (specId) => specById[specId] || '—';
  const teamNeeds = (() => {
    const map = new Map();
    (idea?.team_slots || []).forEach((s) => {
      const row = map.get(s.specialization_id) || {
        specialization_id: s.specialization_id,
        alternate_specialization_id: s.alternate_specialization_id || null,
        count: 0,
      };
      row.count += 1;
      map.set(s.specialization_id, row);
    });
    return [...map.values()];
  })();
  const hasAlternate = teamNeeds.some((r) => r.alternate_specialization_id);

  const ownerName = ownerProfile
    ? (i18n.language === 'ar'
        ? `${ownerProfile.first_name_ar} ${ownerProfile.last_name_ar}`
        : `${ownerProfile.first_name_en} ${ownerProfile.last_name_en}`).trim()
    : (idea?.owner ? (i18n.language === 'ar' ? idea.owner.name_ar : idea.owner.name_en) : '—');
  const ownerAvatar = ownerProfile?.avatar_url || idea?.owner?.avatar_url || null;
  const ownerSpecName = ownerProfile?.specializations?.length
    ? ownerProfile.specializations.join('، ')
    : '';

  function toggleProfile() {
    setProfileOpen((v) => !v);
  }

  const slotLabel = (s) => {
    const start = new Date(s.start_time);
    const end = new Date(s.end_time);
    const locale = i18n.language === 'ar' ? 'ar' : 'en';
    const day = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(start);
    const time = (d) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d);
    return `${day} · ${time(start)} – ${time(end)}`;
  };

  async function handleJoin() {
    setJoinError('');
    setJoinMsg('');
    if (!selectedSlot) {
      setJoinError(t('ideaDetails.pickSlot'));
      return;
    }
    setJoining(true);
    try {
      const note = joinNote.trim();
      await createJoinRequest({ project_id: id, slot_id: selectedSlot, message: note || null });
      setJoinMsg(t('ideaDetails.joinSuccess'));
      setJoinNote('');
    } catch (err) {
      setJoinError(getApiErrorMessage(err, t('ideaDetails.joinError')));
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="id">
      <Sidebar activeKey="ideas" onNavigate={onNavigate} />

      <div className="id__main">
        <Navbar userName={fullName} />

        <main className="id__body">
          <button type="button" className="id__back" onClick={() => onNavigate?.('ideas')}>
            <ArrowLeft width={20} height={20} aria-hidden="true" />
            {t('ideaDetails.back')}
          </button>

          {loading ? (
            <p className="id__state">{t('ideaDetails.loading')}</p>
          ) : !idea ? (
            <p className="id__state">{t('ideaDetails.notFound')}</p>
          ) : (
            <div className="id__grid">
              {/* Main */}
              <section className="id__card">
                <h1 className="id__title">{idea.title}</h1>

                <div className="id__meta">
                  <span className="id__pill">
                    <CalendarIcon width={16} height={16} aria-hidden="true" />
                    {t('myProjects.postedDaysAgo', { count: daysSince(idea.created_at) })}
                  </span>
                  <span className="id__pill">
                    <UserCheck width={16} height={16} aria-hidden="true" />
                    {t('myProjects.opening', { count: idea.team_members_needed })}
                  </span>
                  <span className="id__pill id__pill--stage">
                    <Flag width={14} height={14} aria-hidden="true" />
                    {t(STAGE_LABEL[idea.stage] || STAGE_LABEL.planning)}
                  </span>
                  {industryName && (
                    <span className="id__pill">
                      <Briefcase width={15} height={15} aria-hidden="true" />
                      {industryName}
                    </span>
                  )}
                </div>

                {idea.description && (
                  <div className="id__section">
                    <h2 className="id__section-title">{t('ideaDetails.aboutTitle')}</h2>
                    {/* Markdown authored in the create-idea editor. Legacy
                        HTML descriptions are detected and sanitized instead. */}
                    <DescriptionView className="id__richtext" value={idea.description} />
                  </div>
                )}

                {idea.more_info && (
                  <div className="id__section">
                    <h2 className="id__section-title">{t('createIdea.rolesNeeded')}</h2>
                    <p className="id__section-body">{idea.more_info}</p>
                  </div>
                )}

                {teamNeeds.length > 0 && (
                  <div className="id__section">
                    <h2 className="id__section-title">{t('ideaDetails.teamNeedsTitle')}</h2>
                    <div className="id__table-wrap">
                      <table className="id__table">
                        <thead>
                          <tr>
                            <th>{t('ideaDetails.specColumn')}</th>
                            {hasAlternate && <th>{t('ideaDetails.alternateColumn')}</th>}
                            <th className="id__table-num">{t('ideaDetails.seatsColumn')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamNeeds.map((r) => (
                            <tr key={r.specialization_id}>
                              <td>{specName(r.specialization_id)}</td>
                              {hasAlternate && (
                                <td className="id__table-alt">
                                  {r.alternate_specialization_id ? specName(r.alternate_specialization_id) : '—'}
                                </td>
                              )}
                              <td className="id__table-num">{r.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="id__table-total">
                      {t('ideaDetails.teamNeedsTotal', { total: idea.team_members_needed })}
                    </p>
                  </div>
                )}

                {idea.skills?.length > 0 && (
                  <div className="id__section">
                    <h2 className="id__section-title">{t('ideaDetails.requiredSkills')}</h2>
                    <div className="id__tags">
                      {idea.skills.map((s) => (
                        <span key={s.id} className="id__tag">{s.name}</span>
                      ))}
                    </div>
                  </div>
                )}

              </section>

              {/* Side */}
              <aside className="id__side">
                <div className="id__panel">
                  <h2 className="id__panel-title">{t('ideaDetails.ownerTitle')}</h2>
                  <div className="id__owner">
                    <span className="id__owner-avatar" aria-hidden="true">
                      {ownerAvatar ? (
                        <img src={ownerAvatar} alt="" className="id__owner-img" />
                      ) : (
                        <UserRound width={30} height={30} />
                      )}
                    </span>
                    <div>
                      <p className="id__owner-name">{ownerName}</p>
                      {ownerSpecName && <p className="id__owner-role">{ownerSpecName}</p>}
                    </div>
                  </div>

                  {/* Expands smoothly (grid-rows 0fr→1fr) to reveal the rest of
                      the owner's public profile (already loaded on mount). */}
                  <div className={`id__profile-exp${profileOpen ? ' id__profile-exp--open' : ''}`}>
                    <div className="id__profile-exp-inner">
                      {ownerLoading ? (
                        <p className="id__profile-state">{t('ideaDetails.loadingProfile')}</p>
                      ) : ownerProfile ? (
                        <div className="id__profile">
                          <hr className="id__divider" />
                          {ownerProfile.years_of_experience && (
                            <div className="id__profile-field">
                              <span className="id__profile-label">{t('ideaDetails.experience')}</span>
                              <span className="id__profile-value">
                                {formatExperience(ownerProfile.years_of_experience, t)}
                              </span>
                            </div>
                          )}
                          {ownerProfile.bio && (
                            <div className="id__profile-field">
                              <span className="id__profile-label">{t('ideaDetails.bio')}</span>
                              <p className="id__profile-bio">{ownerProfile.bio}</p>
                            </div>
                          )}
                          {ownerProfile.skills?.length > 0 && (
                            <div className="id__profile-field">
                              <span className="id__profile-label">{t('ideaDetails.skills')}</span>
                              <div className="id__tags">
                                {ownerProfile.skills.map((s) => (
                                  <span key={s} className="id__tag">{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="id__profile-state">{t('ideaDetails.profileError')}</p>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="id__view-profile"
                    onClick={toggleProfile}
                    aria-expanded={profileOpen}
                    disabled={!idea.owner?.id}
                    trailingIcon={
                      <ChevronDown
                        width={18}
                        height={18}
                        className={`id__view-chev${profileOpen ? ' id__view-chev--up' : ''}`}
                        aria-hidden="true"
                      />
                    }
                  >
                    {profileOpen ? t('ideaDetails.hideProfile') : t('ideaDetails.viewProfile')}
                  </Button>
                </div>

                <div className="id__panel">
                  <h2 className="id__panel-title">{t('ideaDetails.joinTitle')}</h2>

                  {slots.length === 0 ? (
                    <p className="id__no-slots">{t('ideaDetails.noSlots')}</p>
                  ) : (
                    <ul className="id__slots bayn-scroll">
                      {slots.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            className={`id__slot${selectedSlot === s.id ? ' id__slot--active' : ''}`}
                            onClick={() => setSelectedSlot(s.id)}
                          >
                            {slotLabel(s)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {slots.length > 0 && (
                    <Input
                      label={t('ideaDetails.noteLabel')}
                      multiline
                      rows={3}
                      maxLength={JOIN_NOTE_MAX}
                      value={joinNote}
                      onChange={(e) => setJoinNote(e.target.value)}
                      supportingText={`${joinNote.length}/${JOIN_NOTE_MAX}`}
                      className="id__note"
                    />
                  )}

                  {joinError && <p className="id__error">{joinError}</p>}
                  {joinMsg && <p className="id__success">{joinMsg}</p>}
                  <Button
                    variant="primary"
                    size="md"
                    className="id__join"
                    onClick={handleJoin}
                    disabled={joining || slots.length === 0}
                    trailingIcon={<SendHorizontal width={20} height={20} aria-hidden="true" />}
                  >
                    {joining ? t('ideaDetails.sending') : t('ideaDetails.sendJoin')}
                  </Button>
                </div>

                <div className="id__panel">
                  <h2 className="id__panel-title">{t('ideaDetails.nextTitle')}</h2>
                  <ol className="id__steps">
                    <li className="id__step">
                      <Send width={20} height={20} aria-hidden="true" />
                      <span>{t('ideaDetails.step1')}</span>
                    </li>
                    <li className="id__step">
                      <FileText width={20} height={20} aria-hidden="true" />
                      <span>{t('ideaDetails.step2')}</span>
                    </li>
                    <li className="id__step">
                      <MessageSquareText width={20} height={20} aria-hidden="true" />
                      <span>{t('ideaDetails.step3')}</span>
                    </li>
                    <li className="id__step">
                      <CircleCheck width={20} height={20} aria-hidden="true" />
                      <span>{t('ideaDetails.step4')}</span>
                    </li>
                  </ol>
                </div>
              </aside>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
