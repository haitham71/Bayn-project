import { useTranslation } from 'react-i18next';
import { useLangNavigate } from '@/shared/hooks/useLang';
import Flag from '@/assets/icons/flag.svg?react';
import UserCheck from '@/assets/icons/user-check.svg?react';
import List from '@/assets/icons/list.svg?react';
import { STAGE_LABEL, daysSince } from '../lib/projects';
import './projectCard.css';

// A project the current user owns — with edit and join-requests shortcuts.
export default function OwnedProjectCard({ project: p }) {
  const { t } = useTranslation();
  const navigate = useLangNavigate();

  return (
    <article className="mp__project">
      <span className="mp__project-label">{t('myProjects.projectLabel')}</span>
      <h2 className="mp__project-title">{p.title}</h2>
      <div className="mp__pills">
        <span className="mp__pill">
          <Flag width={14} height={14} aria-hidden="true" />
          {t(STAGE_LABEL[p.stage] || STAGE_LABEL.planning)}
        </span>
        <span className="mp__pill">
          <UserCheck width={16} height={16} aria-hidden="true" />
          {t('myProjects.opening', { count: p.team_members_needed })}
        </span>
      </div>
      <div className="mp__project-foot">
        <span className="mp__posted">
          {t('myProjects.postedDaysAgo', { count: daysSince(p.created_at) })}
        </span>
        <div className="mp__project-actions">
          <button type="button" className="mp__link" onClick={() => navigate(`/edit-idea/${p.id}`)}>
            {t('myProjects.viewDetails')}
            <List width={18} height={18} aria-hidden="true" />
          </button>
          <button type="button" className="mp__link" onClick={() => navigate(`/join-requests/${p.id}`)}>
            {t('myProjects.joinRequests')}
            <UserCheck width={18} height={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
