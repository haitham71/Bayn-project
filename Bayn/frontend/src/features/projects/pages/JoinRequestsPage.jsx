import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Button from '@/shared/components/Button';
import MeetingScheduler from '@/shared/components/MeetingScheduler';
import ArrowLeft from '@/assets/icons/arrow-left.svg?react';
import Clock from '@/assets/icons/clock.svg?react';
import CircleCheck from '@/assets/icons/circle-check.svg?react';
import CircleX from '@/assets/icons/circle-x.svg?react';
import FilePen from '@/assets/icons/file-pen.svg?react';
import MapPin from '@/assets/icons/map-pin.svg?react';
import Eye from '@/assets/icons/eye.svg?react';
import UserPlus from '@/assets/icons/user-plus.svg?react';
import './JoinRequestsPage.css';

// Mock data — replaced by the join-requests API later.
const PROJECT = 'AI-Powered Personal Finance Assistant';

// Meeting slots the owner picked earlier. Past days are dropped by the scheduler,
// which frees them up so up to 3 upcoming days can be chosen again.
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}
const SAVED_MEETINGS = [
  { date: daysFromNow(3), slots: [{ start: '10:00', end: '11:00' }] },
  { date: daysFromNow(6), slots: [{ start: '14:00', end: '15:00' }, { start: '16:00', end: '17:00' }] },
];
const REQUESTS = [
  { id: 1, name: 'Jmal A*****', role: 'Full Stack Developer', location: 'Riyadh, Saudi Arabia', applied: '1 hour ago', skills: ['Node js', 'React', 'Python', 'PostgreSQL'], extra: 2, message: "Hello! I'm interested in joining your project and believe my skills align well with your requirements. I have experience...", status: 'pending' },
  { id: 2, name: 'Jmal A*****', role: 'Full Stack Developer', location: 'Riyadh, Saudi Arabia', applied: '1 hour ago', skills: ['Node js', 'React', 'Python', 'PostgreSQL'], extra: 2, message: "Hello! I'm interested in joining your project and believe my skills align well with your requirements. I have experience...", status: 'pending' },
  { id: 3, name: 'Jmal A*****', role: 'Full Stack Developer', location: 'Riyadh, Saudi Arabia', applied: '1 hour ago', skills: ['Node js', 'React', 'Python', 'PostgreSQL'], extra: 2, message: "Hello! I'm interested in joining your project and believe my skills align well with your requirements. I have experience...", status: 'pending' },
];

export default function JoinRequestsPage({ onNavigate }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('pending');
  const [visibility, setVisibility] = useState('public');
  const [joinOpen, setJoinOpen] = useState(true);

  const counts = {
    pending: REQUESTS.filter((r) => r.status === 'pending').length,
    accepted: REQUESTS.filter((r) => r.status === 'accepted').length,
    rejected: REQUESTS.filter((r) => r.status === 'rejected').length,
  };
  const total = REQUESTS.length;

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

  const visible = REQUESTS.filter((r) => r.status === tab);

  return (
    <div className="jr bayn-scroll">
      <Sidebar activeKey="projects" onNavigate={onNavigate} />

      <div className="jr__main">
        <Navbar userName="Assad Al-saeed" />

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
                    <span className="jr__avatar" aria-hidden="true">{r.name.trim().charAt(0)}</span>

                    <div className="jr__req-info">
                      <p className="jr__req-name">{r.name}</p>
                      <p className="jr__req-role">{r.role}</p>
                      <p className="jr__req-loc">
                        <MapPin width={14} height={14} aria-hidden="true" />
                        {r.location}
                      </p>
                      <p className="jr__req-applied">{r.applied}</p>
                    </div>

                    <div className="jr__req-body">
                      <ul className="jr__chips">
                        {r.skills.map((skill) => (
                          <li key={skill} className="jr__chip">{skill}</li>
                        ))}
                        {r.extra > 0 && <li className="jr__chip jr__chip--more">+{r.extra}</li>}
                      </ul>
                      <p className="jr__msg-label">{t('joinRequests.message')}</p>
                      <p className="jr__msg">{r.message}</p>
                    </div>

                    <div className="jr__req-actions">
                      <Button variant="primary" size="sm">{t('joinRequests.accept')}</Button>
                      <Button variant="secondary" size="sm">{t('joinRequests.reject')}</Button>
                      <Button variant="secondary" size="sm">{t('joinRequests.viewProfile')}</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Right rail */}
          <aside className="jr__side">
            <section className="jr__card jr__tips">
              <h2 className="jr__about-title">{t('joinRequests.tips')}</h2>
            </section>

            <section className="jr__card jr__about">
              <h2 className="jr__about-title">{t('joinRequests.about')}</h2>
              <p className="jr__about-project">{PROJECT}</p>
              <p className="jr__about-hint">{t('createIdea.summaryHint')}</p>

              <ul className="jr__about-rows">
                <li className="jr__about-row">
                  <Eye width={22} height={22} aria-hidden="true" />
                  <span className="jr__about-label">{t('createIdea.visibility')}</span>
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

                <li className="jr__about-row">
                  <UserPlus width={22} height={22} aria-hidden="true" />
                  <span className="jr__about-label">{t('createIdea.joinRequest')}</span>
                  <div className="jr__toggle" role="group" aria-label={t('createIdea.joinRequest')}>
                    <button
                      type="button"
                      className={`jr__toggle-opt${joinOpen ? ' jr__toggle-opt--active' : ''}`}
                      onClick={() => setJoinOpen(true)}
                    >
                      {t('createIdea.joinRequestValue')}
                    </button>
                    <button
                      type="button"
                      className={`jr__toggle-opt${!joinOpen ? ' jr__toggle-opt--active' : ''}`}
                      onClick={() => setJoinOpen(false)}
                    >
                      {t('createIdea.joinRequestOff')}
                    </button>
                  </div>
                </li>
              </ul>

              <MeetingScheduler value={SAVED_MEETINGS} maxDays={3} maxSlots={3} />

              <Button variant="secondary" size="sm" className="jr__save">
                {t('joinRequests.saveEdit')}
              </Button>
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}
