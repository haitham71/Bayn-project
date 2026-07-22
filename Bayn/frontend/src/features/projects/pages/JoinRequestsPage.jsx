import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Input from '@/shared/components/Input';
import ConfirmDialog from '@/shared/components/ConfirmDialog';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { STAGES } from '@/features/meetings/lib/requestStatus';
import ArrowLeft from '@/assets/icons/arrow-left.svg?react';
import Clock from '@/assets/icons/clock.svg?react';
import CircleCheck from '@/assets/icons/circle-check.svg?react';
import CircleX from '@/assets/icons/circle-x.svg?react';
import FilePen from '@/assets/icons/file-pen.svg?react';
import Lightbulb from '@/assets/icons/lightbulb.svg?react';
import { getProject } from '../services/projectService';
import { useJoinRequests } from '../hooks/useJoinRequests';
import RequestCard from '../components/RequestCard';
import './JoinRequestsPage.css';

export default function JoinRequestsPage({ onNavigate }) {
  const { t } = useTranslation();
  const { fullName } = useCurrentUser();
  const { projectId } = useParams();

  const jr = useJoinRequests(projectId);
  const { counts } = jr;

  // Only the project's name is needed here — the chip under the page title.
  const [project, setProject] = useState(null);
  useEffect(() => {
    if (!projectId) return;
    getProject(projectId).then(setProject).catch(() => {});
  }, [projectId]);

  const stats = [
    { icon: Clock, label: t('joinRequests.statPending'), value: counts.pending, note: t('joinRequests.newRequests') },
    { icon: FilePen, label: t('joinRequests.statSigning'), value: counts.signing, note: t('joinRequests.signingNote') },
    { icon: CircleCheck, label: t('joinRequests.statApproved'), value: counts.approved, note: t('joinRequests.approvedNote') },
    { icon: CircleX, label: t('joinRequests.statRejected'), value: counts.rejected, note: t('joinRequests.rejectedRequests') },
  ];
  const tabs = STAGES.map((key) => ({ key, label: t(`joinRequests.tab.${key}`), count: counts[key] }));

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
            {project?.title && (
              <span className="jr__project">
                <Lightbulb width={16} height={16} aria-hidden="true" />
                {project.title}
              </span>
            )}
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
                  aria-selected={jr.tab === tb.key}
                  className={`jr__tab${jr.tab === tb.key ? ' jr__tab--active' : ''}`}
                  onClick={() => jr.setTab(tb.key)}
                >
                  {tb.label} ({tb.count})
                </button>
              ))}
            </div>

            {/* Request list */}
            {jr.visible.length === 0 ? (
              <p className="jr__empty">{t('joinRequests.empty')}</p>
            ) : (
              <ul className="jr__list">
                {jr.visible.map((r) => (
                  <RequestCard
                    key={r.id}
                    request={r}
                    now={jr.now}
                    actioningId={jr.actioningId}
                    onAccept={jr.openAccept}
                    onReject={jr.handleReject}
                    onFinalize={jr.handleFinalize}
                  />
                ))}
              </ul>
            )}

            {jr.actionError && <p className="jr__error">{jr.actionError}</p>}
          </section>
        </main>
      </div>

      <ConfirmDialog
        open={jr.acceptId != null}
        title={t('joinRequests.acceptTitle')}
        message={t('joinRequests.acceptMsg')}
        confirmLabel={t('joinRequests.accept')}
        cancelLabel={t('joinRequests.cancel')}
        onConfirm={jr.confirmAccept}
        onCancel={jr.closeAccept}
      >
        <Input
          label={t('joinRequests.meetingTitle')}
          supportingText={t('joinRequests.meetingTitleHint')}
          value={jr.acceptTitle}
          onChange={(e) => jr.setAcceptTitle(e.target.value.slice(0, 200))}
        />
      </ConfirmDialog>
    </div>
  );
}
