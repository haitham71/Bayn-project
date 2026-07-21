import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ChevronRight from '@/assets/icons/chevron-right.svg?react';
import { listProjectMembers } from '@/features/projects/services/projectService';

// "Current team" card: pick one of my projects and show its members.
export default function TeamCard({ projects }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  const [projectId, setProjectId] = useState('');
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (projects.length && !projects.some((p) => p.id === projectId)) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  useEffect(() => {
    if (!projectId) { setMembers([]); return; }
    listProjectMembers(projectId).then((rows) => setMembers(rows || [])).catch(() => setMembers([]));
  }, [projectId]);

  const project = projects.find((p) => p.id === projectId) || null;
  const next = () => {
    if (projects.length < 2) return;
    const i = projects.findIndex((p) => p.id === projectId);
    setProjectId(projects[(i + 1) % projects.length].id);
  };

  return (
    <article className="home__card">
      <h2 className="home__card-title">{t('home.teamLabel')}</h2>
      <div className="home__card-body">
        {projects.length === 0 ? (
          <p className="home__team-empty">{t('home.teamEmpty')}</p>
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
            <ul className="home__team-list bayn-scroll">
              {members.map((mem) => {
                const name = ((locale === 'ar' ? mem.name_ar : mem.name_en) || '').trim();
                const specialization = locale === 'ar' ? mem.specialization_ar : mem.specialization_en;
                return (
                  <li key={mem.user_id} className="home__team-member">
                    {mem.avatar_url ? (
                      <img className="home__team-avatar home__team-avatar--img" src={mem.avatar_url} alt="" />
                    ) : (
                      <span className="home__team-avatar">{name.charAt(0).toUpperCase() || '؟'}</span>
                    )}
                    <span className="home__team-info">
                      <span className="home__team-name">{name || t('home.profileName')}</span>
                      {specialization && <span className="home__team-role">{specialization}</span>}
                    </span>
                    <span className={`home__team-badge${mem.role === 'owner' ? ' home__team-badge--owner' : ''}`}>
                      {t(mem.role === 'owner' ? 'home.roleOwner' : 'home.roleMember')}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </article>
  );
}
