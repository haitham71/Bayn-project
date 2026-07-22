import { useTranslation } from 'react-i18next';
import { useLangNavigate } from '@/shared/hooks/useLang';
import Flag from '@/assets/icons/flag.svg?react';
import { STAGE_LABEL } from '../lib/constants';
import './RecommendedIdeas.css';

// A random handful of public ideas surfaced at the bottom of the main column.
export default function RecommendedIdeas({ ideas }) {
  const { t, i18n } = useTranslation();
  const navigate = useLangNavigate();
  const locale = i18n.language === 'ar' ? 'ar' : 'en';

  return (
    <article className="home__card home__card--calendar">
      <h2 className="home__card-title">{t('home.recLabel')}</h2>
      <div className="home__card-body">
        {ideas.length === 0 ? (
          <p className="home__rec-empty">{t('home.recEmpty')}</p>
        ) : (
          <div className="home__rec-grid">
            {ideas.map((idea) => {
              const owner = idea.owner;
              const ownerName = (owner ? (locale === 'ar' ? owner.name_ar : owner.name_en) : '') || '';
              return (
                <button
                  key={idea.id}
                  type="button"
                  className="home__rec-card"
                  onClick={() => navigate(`/ideas/${idea.id}`)}
                >
                  <span className="home__rec-owner">
                    {owner?.avatar_url ? (
                      <img className="home__rec-avatar home__rec-avatar--img" src={owner.avatar_url} alt="" />
                    ) : (
                      <span className="home__rec-avatar">{ownerName.charAt(0).toUpperCase() || '؟'}</span>
                    )}
                    <span className="home__rec-owner-name">{ownerName || t('home.profileName')}</span>
                  </span>

                  <span className="home__rec-title">{idea.title}</span>

                  <span className="home__rec-stage">
                    <Flag width={13} height={13} aria-hidden="true" />
                    {t(STAGE_LABEL[idea.stage] || STAGE_LABEL.planning)}
                  </span>

                  {idea.skills?.length > 0 && (
                    <span className="home__rec-skills">
                      {idea.skills.slice(0, 3).map((s) => (
                        <span key={s.id} className="home__rec-skill">{s.name}</span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}
