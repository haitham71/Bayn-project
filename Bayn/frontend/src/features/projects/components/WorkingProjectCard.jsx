import { useTranslation } from 'react-i18next';
import { useLangNavigate } from '@/shared/hooks/useLang';
import Flag from '@/assets/icons/flag.svg?react';
import CheckSquare from '@/assets/icons/check-square.svg?react';
import LayoutDashboard from '@/assets/icons/layout-dashboard.svg?react';
import { STAGE_LABEL } from '../lib/projects';
import './projectCard.css';

// How many member avatars fit before the rest collapse into a "+N" chip.
const AVATARS_SHOWN = 4;

// A project the current user works on (member or owner) — links to its dashboard.
// `stats` (optional) carries the team and open-task count for the quick summary.
export default function WorkingProjectCard({ project: p, stats }) {
  const { t, i18n } = useTranslation();
  const navigate = useLangNavigate();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  const members = stats?.members || [];
  const shown = members.slice(0, AVATARS_SHOWN);
  const rest = members.slice(AVATARS_SHOWN);
  const memberName = (m) => ((locale === 'ar' ? m.name_ar : m.name_en) || m.username || '').trim();
  // Tooltip repeats the role so the owner is identifiable without opening the board.
  const memberTitle = (m) => {
    const role = t(m.role === 'owner' ? 'home.roleOwner' : 'home.roleMember');
    return `${memberName(m)} · ${role}`;
  };

  return (
    <article className="mp__project">
      <span className="mp__project-label">{t('myProjects.projectLabel')}</span>
      <h2 className="mp__project-title">{p.title}</h2>

      {/* Quick summary — who's on the team and what's still open. */}
      <div className="mp__summary">
        {members.length > 0 && (
          <ul className="mp__avatars">
            {shown.map((m) => (
              <li key={m.user_id} className="mp__avatar" title={memberTitle(m)}>
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="mp__avatar-img" />
                ) : (
                  memberName(m).charAt(0).toUpperCase() || '?'
                )}
              </li>
            ))}
            {rest.length > 0 && (
              <li
                className="mp__avatar mp__avatar--more"
                title={rest.map(memberName).join('\n')}
              >
                +{rest.length}
              </li>
            )}
          </ul>
        )}
        {stats && (
          <span className="mp__pill mp__pill--tasks">
            <CheckSquare width={14} height={14} aria-hidden="true" />
            {t('myProjects.openTasks', { count: stats.openTasks })}
          </span>
        )}
      </div>

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
