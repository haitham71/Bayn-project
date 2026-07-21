import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Flag from '@/assets/icons/flag.svg?react';
import LayoutDashboard from '@/assets/icons/layout-dashboard.svg?react';
import { STAGE_LABEL } from '../lib/projects';
import './projectCard.css';

// A project the current user works on (member or owner) — links to its dashboard.
export default function WorkingProjectCard({ project: p }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <article className="mp__project">
      <span className="mp__project-label">{t('myProjects.projectLabel')}</span>
      <h2 className="mp__project-title">{p.title}</h2>
      <div className="mp__project-foot">
        <span className="mp__pill">
          <Flag width={14} height={14} aria-hidden="true" />
          {t(STAGE_LABEL[p.stage] || STAGE_LABEL.planning)}
        </span>
        <button type="button" className="mp__link" onClick={() => navigate(`/projects/${p.id}/dashboard`)}>
          {t('myProjects.dashboard')}
          <LayoutDashboard width={18} height={18} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
