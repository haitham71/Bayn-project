import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Button from '@/shared/components/Button';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import {
  listMeetingRequests,
  acceptMeetingRequest,
  rejectMeetingRequest,
} from '@/features/meetings/services/meetingService';
import ArrowLeft from '@/assets/icons/arrow-left.svg?react';
import Clock from '@/assets/icons/clock.svg?react';
import CircleCheck from '@/assets/icons/circle-check.svg?react';
import CircleX from '@/assets/icons/circle-x.svg?react';
import FilePen from '@/assets/icons/file-pen.svg?react';
import Calendar from '@/assets/icons/calendar.svg?react';
import './JoinRequestsPage.css';

export default function JoinRequestsPage({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const { fullName } = useCurrentUser();
  const [tab, setTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [actioningId, setActioningId] = useState(null);

  function load() {
    listMeetingRequests('incoming')
      .then((rows) => setRequests(rows || []))
      .catch(() => {});
  }
  useEffect(() => { load(); }, []);

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
  const slotLabel = (r) => {
    const locale = i18n.language === 'ar' ? 'ar' : 'en';
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
                      <p className="jr__req-loc">
                        <Calendar width={14} height={14} aria-hidden="true" />
                        {slotLabel(r)}
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

          {/* Right rail */}
          <aside className="jr__side">
            <section className="jr__card jr__tips">
              <h2 className="jr__about-title">{t('joinRequests.tips')}</h2>
              <p className="jr__about-hint">{t('joinRequests.subtitle')}</p>
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}
