import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Button from '@/shared/components/Button';
import Input from '@/shared/components/Input';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { getProject, getProjectSlots } from '@/features/projects/services/projectService';
import { createJoinRequest } from '@/features/meetings/services/meetingService';
import { getIndustries } from '@/features/identity/services/authService';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import ArrowLeft from '@/assets/icons/arrow-left.svg?react';
import Bookmark from '@/assets/icons/bookmark.svg?react';
import Share2 from '@/assets/icons/share-2.svg?react';
import CalendarIcon from '@/assets/icons/calendar.svg?react';
import UserCheck from '@/assets/icons/user-check.svg?react';
import Flag from '@/assets/icons/flag.svg?react';
import UserRound from '@/assets/icons/user-round.svg?react';
import Star from '@/assets/icons/star.svg?react';
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
  const [slots, setSlots] = useState([]);
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
    ])
      .then(([p, inds, sl]) => {
        setIdea(p);
        setIndustries(inds || []);
        setSlots(sl || []);
      })
      .catch(() => setIdea(null))
      .finally(() => setLoading(false));
  }, [id]);

  const industryName = idea ? (industries.find((i) => i.id === idea.industry_id)?.name || '') : '';

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
                <div className="id__card-actions">
                  <button type="button" className="id__icon-btn" aria-label={t('ideaDetails.save')}>
                    <Bookmark width={20} height={20} aria-hidden="true" />
                  </button>
                  <button type="button" className="id__icon-btn" aria-label={t('ideaDetails.share')}>
                    <Share2 width={20} height={20} aria-hidden="true" />
                  </button>
                </div>

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
                </div>

                {idea.description && (
                  <div className="id__section">
                    <h2 className="id__section-title">{t('ideaDetails.aboutTitle')}</h2>
                    {/* Rich text authored in the create-idea editor — sanitized
                        with DOMPurify before rendering to close the XSS hole. */}
                    <div
                      className="id__richtext"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(idea.description) }}
                    />
                  </div>
                )}

                {idea.more_info && (
                  <div className="id__section">
                    <h2 className="id__section-title">{t('createIdea.rolesNeeded')}</h2>
                    <p className="id__section-body">{idea.more_info}</p>
                  </div>
                )}

                {industryName && (
                  <>
                    <hr className="id__divider" />
                    <div className="id__tags">
                      <span className="id__tag">{industryName}</span>
                    </div>
                  </>
                )}
              </section>

              {/* Side */}
              <aside className="id__side">
                <div className="id__panel">
                  <h2 className="id__panel-title">{t('ideaDetails.ownerTitle')}</h2>
                  <div className="id__owner">
                    <span className="id__owner-avatar" aria-hidden="true">
                      {idea.owner?.avatar_url ? (
                        <img src={idea.owner.avatar_url} alt="" className="id__owner-img" />
                      ) : (
                        <UserRound width={30} height={30} />
                      )}
                    </span>
                    <div>
                      <p className="id__owner-name">
                        {idea.owner
                          ? (i18n.language === 'ar' ? idea.owner.name_ar : idea.owner.name_en)
                          : '—'}
                      </p>
                      <p className="id__owner-role">{idea.owner?.job_title || ''}</p>
                    </div>
                  </div>
                  <div className="id__owner-stats">
                    <div className="id__stat">
                      <span className="id__stat-num">—</span>
                      <span className="id__stat-label">{t('ideaDetails.projects')}</span>
                    </div>
                    <div className="id__stat">
                      <span className="id__stat-num">
                        <Star width={14} height={14} aria-hidden="true" /> —
                      </span>
                      <span className="id__stat-label">{t('ideaDetails.rating')}</span>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" className="id__view-profile" disabled>
                    {t('ideaDetails.viewProfile')}
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
