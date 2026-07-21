import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ChevronRight from '@/assets/icons/chevron-right.svg?react';
import { listMeetingRequests } from '@/features/meetings/services/meetingService';
import { stageOf } from '@/features/meetings/lib/requestStatus';
import { timeAgo } from '@/shared/lib/relativeTime';

// "Application's status" card: latest join requests for a chosen owned project.
export default function ApplicationsCard({ projects }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  const [projectId, setProjectId] = useState('');
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (projects.length && !projects.some((p) => p.id === projectId)) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  useEffect(() => {
    if (!projectId) { setRequests([]); return; }
    listMeetingRequests('incoming', projectId)
      .then((rows) => setRequests([...(rows || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))))
      .catch(() => setRequests([]));
  }, [projectId]);

  const project = projects.find((p) => p.id === projectId) || null;
  const next = () => {
    if (projects.length < 2) return;
    const i = projects.findIndex((p) => p.id === projectId);
    setProjectId(projects[(i + 1) % projects.length].id);
  };

  return (
    <article className="home__card">
      <h2 className="home__card-title">{t('home.statusLabel')}</h2>
      <div className="home__card-body">
        {projects.length === 0 ? (
          <p className="home__team-empty">{t('home.statusNoProjects')}</p>
        ) : (
          <>
            <div className="home__team-switch">
              <span className="home__team-project">{project?.title}</span>
              {projects.length > 1 && (
                <button
                  type="button"
                  className="home__team-next"
                  onClick={next}
                  aria-label={t('home.teamNext')}
                  title={t('home.teamNext')}
                >
                  <ChevronRight width={20} height={20} aria-hidden="true" />
                </button>
              )}
            </div>

            {requests.length === 0 ? (
              <p className="home__team-empty">{t('home.statusEmpty')}</p>
            ) : (
              <ul className="home__status-list bayn-scroll">
                {requests.slice(0, 8).map((r) => {
                  const name = ((locale === 'ar' ? r.requester?.name_ar : r.requester?.name_en) || '').trim();
                  const stage = stageOf(r);
                  return (
                    <li key={r.id} className="home__status-item">
                      <span className="home__team-avatar">{name.charAt(0).toUpperCase() || '؟'}</span>
                      <span className="home__team-info">
                        <span className="home__team-name">{name || t('home.profileName')}</span>
                        <span className="home__team-role">{t('joinRequests.applied', { when: timeAgo(r.created_at, locale) })}</span>
                      </span>
                      <span className={`home__status-badge home__status-badge--${stage}`}>
                        {t(`joinRequests.tab.${stage}`)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </article>
  );
}
