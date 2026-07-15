import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Button from '@/shared/components/Button';
import MeetingScheduler from '@/shared/components/MeetingScheduler';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import {
  listMeetingRequests,
  acceptMeetingRequest,
  rejectMeetingRequest,
} from '@/features/meetings/services/meetingService';
import {
  getProject,
  getProjectSlots,
  updateProject,
  replaceSlots,
} from '@/features/projects/services/projectService';
import { getApiErrorMessage } from '@/shared/lib/apiError';
import { timeAgo } from '@/shared/lib/relativeTime';
import ArrowLeft from '@/assets/icons/arrow-left.svg?react';
import Clock from '@/assets/icons/clock.svg?react';
import CircleCheck from '@/assets/icons/circle-check.svg?react';
import CircleX from '@/assets/icons/circle-x.svg?react';
import FilePen from '@/assets/icons/file-pen.svg?react';
import Calendar from '@/assets/icons/calendar.svg?react';
import MapPin from '@/assets/icons/map-pin.svg?react';
import Eye from '@/assets/icons/eye.svg?react';
import './JoinRequestsPage.css';

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function slotsToSchedulerValue(slots) {
  const byDay = new Map();
  (slots || []).forEach((s) => {
    const start = new Date(s.start_time);
    const end = new Date(s.end_time);
    const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
    if (!byDay.has(key)) {
      byDay.set(key, { date: new Date(start.getFullYear(), start.getMonth(), start.getDate()), slots: [] });
    }
    byDay.get(key).slots.push({ start: hhmm(start), end: hhmm(end) });
  });
  return [...byDay.values()];
}

function meetingsToSlots(days) {
  const out = [];
  (days || []).forEach((d) => {
    const date = d.date instanceof Date ? d.date : new Date(d.date);
    (d.slots || []).forEach((s) => {
      const [sh, sm] = s.start.split(':').map(Number);
      const [eh, em] = s.end.split(':').map(Number);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), sh, sm);
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), eh, em);
      out.push({ start_time: start.toISOString(), end_time: end.toISOString() });
    });
  });
  return out;
}

export default function JoinRequestsPage({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const { fullName } = useCurrentUser();
  const { projectId } = useParams();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';
  const [tab, setTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [actioningId, setActioningId] = useState(null);

  // Right-rail management for the selected project (meeting slots + visibility).
  const [project, setProject] = useState(null);
  const [schedInitial, setSchedInitial] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [visibility, setVisibility] = useState('public');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  function load() {
    listMeetingRequests('incoming', projectId)
      .then((rows) => setRequests(rows || []))
      .catch(() => {});
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([getProject(projectId), getProjectSlots(projectId).catch(() => [])])
      .then(([p, sl]) => {
        setProject(p);
        setVisibility(p.is_hidden ? 'private' : 'public');
        const val = slotsToSchedulerValue(sl || []);
        setSchedInitial(val);
        setMeetings(val);
      })
      .catch(() => {});
  }, [projectId]);

  async function handleSave() {
    if (!projectId) return;
    setSaving(true);
    setSaveMsg('');
    setSaveError('');
    try {
      await updateProject(projectId, { is_hidden: visibility === 'private' });
      await replaceSlots(projectId, meetingsToSlots(meetings));
      setSaveMsg(t('joinRequests.saved'));
    } catch (e) {
      setSaveError(getApiErrorMessage(e, t('joinRequests.saveError')));
    } finally {
      setSaving(false);
    }
  }

  async function handleAccept(id) {
    setActioningId(id);
    try { await acceptMeetingRequest(id); load(); } catch { /* surfaced by refetch */ } finally { setActioningId(null); }
  }
  async function handleReject(id) {
    setActioningId(id);
    try { await rejectMeetingRequest(id); load(); } catch { /* ignore */ } finally { setActioningId(null); }
  }

  const requesterName = (r) =>
    r.requester ? (i18n.language === 'ar' ? r.requester.name_ar : r.requester.name_en) : '—';
  const requesterLocation = (r) =>
    r.requester ? (i18n.language === 'ar' ? r.requester.location_ar : r.requester.location_en) : '';
  const slotLabel = (r) => {
    const start = new Date(r.proposed_start_time);
    const end = new Date(r.proposed_end_time);
    const day = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(start);
    const time = (d) => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(d);
    return `${day} · ${time(start)} – ${time(end)}`;
  };

  const counts = {
    pending: requests.filter((r) => r.status === 'pending').length,
    accepted: requests.filter((r) => r.status === 'accepted').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  };
  const total = requests.length;

  const stats = [
    { icon: Clock, label: t('joinRequests.statPending'), value: counts.pending, note: t('joinRequests.newRequests') },
    { icon: CircleCheck, label: t('joinRequests.statAccepted'), value: counts.accepted, note: t('joinRequests.acceptedRequests') },
    { icon: CircleX, label: t('joinRequests.statRejected'), value: counts.rejected, note: t('joinRequests.rejectedRequests') },
    { icon: FilePen, label: t('joinRequests.statTotal'), value: total, note: t('joinRequests.totalRequestsNote') },
  ];

  const tabs = [
    { key: 'pending', label: t('joinRequests.tabPending'), count: counts.pending },
    { key: 'accepted', label: t('joinRequests.tabAccepted'), count: counts.accepted },
    { key: 'rejected', label: t('joinRequests.tabRejected'), count: counts.rejected },
  ];

  const visible = requests.filter((r) => r.status === tab);

  return (
    <div className="jr bayn-scroll">
      <Sidebar activeKey="projects" onNavigate={onNavigate} />

      <div className="jr__main">
        <Navbar userName={fullName} />

        <button type="button" className="jr__back" onClick={() => onNavigate?.('myprojects')}>
          <ArrowLeft width={22} height={22} aria-hidden="true" />
          {t('joinRequests.back')}
        </button>

        <main className="jr__body">
          <section className="jr__card jr__content">
            <h1 className="jr__title">{t('joinRequests.title')}</h1>
            <p className="jr__subtitle">{t('joinRequests.subtitle')}</p>

            {/* Stat tiles */}
            <div className="jr__stats">
              {stats.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="jr__stat">
                    <div className="jr__stat-head">
                      <Icon width={32} height={32} aria-hidden="true" />
                      <span className="jr__stat-label">{s.label}</span>
                    </div>
                    <span className="jr__stat-value">{s.value}</span>
                    <span className="jr__stat-note">{s.note}</span>
                  </div>
                );
              })}
            </div>

            {/* Tabs */}
            <div className="jr__tabs" role="tablist">
              {tabs.map((tb) => (
                <button
                  key={tb.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === tb.key}
                  className={`jr__tab${tab === tb.key ? ' jr__tab--active' : ''}`}
                  onClick={() => setTab(tb.key)}
                >
                  {tb.label} ({tb.count})
                </button>
              ))}
            </div>

            {/* Request list */}
            {visible.length === 0 ? (
              <p className="jr__empty">{t('joinRequests.empty')}</p>
            ) : (
              <ul className="jr__list">
                {visible.map((r) => (
                  <li key={r.id} className="jr__req">
                    <span className="jr__avatar" aria-hidden="true">
                      {requesterName(r).trim().charAt(0).toUpperCase()}
                    </span>

                    <div className="jr__req-info">
                      <p className="jr__req-name">{requesterName(r)}</p>
                      {r.requester?.job_title && <p className="jr__req-role">{r.requester.job_title}</p>}
                      {requesterLocation(r) && (
                        <p className="jr__req-loc">
                          <MapPin width={14} height={14} aria-hidden="true" />
                          {requesterLocation(r)}
                        </p>
                      )}
                      <p className="jr__req-slot">
                        <Calendar width={14} height={14} aria-hidden="true" />
                        {slotLabel(r)}
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
                    </div>

                    {r.status === 'pending' && (
                      <div className="jr__req-actions">
                        <Button variant="primary" size="sm" onClick={() => handleAccept(r.id)} disabled={actioningId === r.id}>
                          {t('joinRequests.accept')}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleReject(r.id)} disabled={actioningId === r.id}>
                          {t('joinRequests.reject')}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Right rail — manage this project's meeting slots + visibility */}
          <aside className="jr__side">
            {project && (
              <section className="jr__manage">
                <h2 className="jr__manage-title">{t('joinRequests.manageTitle')}</h2>

                <ul className="jr__manage-rows">
                  <li className="jr__manage-row">
                    <Eye width={20} height={20} aria-hidden="true" />
                    <span className="jr__manage-label">{t('createIdea.visibility')}</span>
                    <div className="jr__toggle" role="group" aria-label={t('createIdea.visibility')}>
                      <button
                        type="button"
                        className={`jr__toggle-opt${visibility === 'public' ? ' jr__toggle-opt--active' : ''}`}
                        onClick={() => setVisibility('public')}
                      >
                        {t('createIdea.visibilityValue')}
                      </button>
                      <button
                        type="button"
                        className={`jr__toggle-opt${visibility === 'private' ? ' jr__toggle-opt--active' : ''}`}
                        onClick={() => setVisibility('private')}
                      >
                        {t('createIdea.visibilityPrivate')}
                      </button>
                    </div>
                  </li>
                </ul>

                <MeetingScheduler
                  key={project.id}
                  title={t('joinRequests.meetingTimes')}
                  value={schedInitial}
                  onChange={setMeetings}
                  maxDays={3}
                  maxSlots={3}
                />

                {saveError && <p className="jr__save-error">{saveError}</p>}
                {saveMsg && <p className="jr__save-msg">{saveMsg}</p>}

                <Button
                  variant="primary"
                  size="sm"
                  className="jr__save"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? t('joinRequests.saving') : t('joinRequests.saveEdit')}
                </Button>
              </section>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}
