import { useState, useEffect, useMemo } from 'react';
import { useLangNavigate } from '@/shared/hooks/useLang';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/shared/components/Sidebar';
import Navbar from '@/shared/components/Navbar';
import Select from '@/shared/components/Select';
import SkillsInput from '@/shared/components/SkillsInput';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { listProjects } from '@/features/projects/services/projectService';
import { getIndustries } from '@/features/identity/services/authService';
import Flag from '@/assets/icons/flag.svg?react';
import UserCheck from '@/assets/icons/user-check.svg?react';
import UserRound from '@/assets/icons/user-round.svg?react';
import Building from '@/assets/icons/building.svg?react';
import List from '@/assets/icons/list.svg?react';
import './IdeasMarketplacePage.css';

// Backend ProjectStage values → translated labels (reuses the create-idea keys).
const STAGE_LABEL = {
  planning: 'createIdea.stagePlanning',
  development: 'createIdea.stageDevelopment',
  launching: 'createIdea.stageLaunching',
};
const STAGE_FILTERS = ['all', 'planning', 'development', 'launching'];

// How many skill chips a card shows before collapsing the rest into a "+N".
const MAX_CARD_SKILLS = 6;

function daysSince(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export default function IdeasMarketplacePage({ onNavigate }) {
  const { t, i18n } = useTranslation();
  const navigate = useLangNavigate();
  const { fullName } = useCurrentUser();

  const [ideas, setIdeas] = useState([]);
  const [industries, setIndustries] = useState([]); // [{ value, label }]
  const [loading, setLoading] = useState(true);

  // Filters
  const [industry, setIndustry] = useState('');   // '' = all
  const [sort, setSort] = useState('recent');      // recent | oldest
  const [stage, setStage] = useState('all');
  const [skills, setSkills] = useState([]);        // selected skill names ([] = any)

  useEffect(() => {
    Promise.all([listProjects(), getIndustries().catch(() => [])])
      .then(([projects, inds]) => {
        setIdeas(projects || []);
        setIndustries((inds || []).map((r) => ({ value: r.id, label: r.name })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const industryName = (id) => industries.find((i) => i.value === id)?.label || '';

  const industryOptions = [{ value: '', label: t('ideas.allIndustries') }, ...industries];
  const sortOptions = [
    { value: 'recent', label: t('ideas.mostRecent') },
    { value: 'oldest', label: t('ideas.oldest') },
  ];

  // Skill options offered by the filter — the distinct skills actually present
  // on the loaded ideas, so a pick never yields zero results by itself.
  const skillOptions = useMemo(() => {
    const names = new Set();
    ideas.forEach((p) => (p.skills || []).forEach((s) => names.add(s.name)));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [ideas]);

  const visible = useMemo(() => {
    let rows = ideas.filter((p) => {
      if (industry && p.industry_id !== industry) return false;
      if (stage !== 'all' && p.stage !== stage) return false;
      // An idea matches when it needs any of the selected skills.
      if (skills.length) {
        const ideaSkills = (p.skills || []).map((s) => s.name);
        if (!skills.some((sk) => ideaSkills.includes(sk))) return false;
      }
      return true;
    });
    rows = rows.sort((a, b) => {
      const diff = new Date(b.created_at) - new Date(a.created_at);
      return sort === 'recent' ? diff : -diff;
    });
    return rows;
  }, [ideas, industry, stage, sort, skills]);

  const hasFilters = industry || stage !== 'all' || sort !== 'recent' || skills.length > 0;
  function clearFilters() {
    setIndustry('');
    setStage('all');
    setSort('recent');
    setSkills([]);
  }

  return (
    <div className="im">
	
      <Sidebar activeKey="ideas" onNavigate={onNavigate} />

      <div className="im__main">
        <Navbar userName={fullName} />

        <main className="im__body">
          <h1 className="im__title">{t('ideas.title')}</h1>

          {/* Filter bar */}
          <section className="im__filters">
            <h2 className="im__filters-title">{t('ideas.filtersTitle')}</h2>

            <div className="im__filter">
              <Select label={t('ideas.industry')} value={industry} onChange={setIndustry} options={industryOptions} className="im__filter-select" />
            </div>

            <div className="im__filter">
              <Select label={t('ideas.sortByDate')} value={sort} onChange={setSort} options={sortOptions} className="im__filter-select" />
            </div>

            <div className="im__filter im__filter--skills">
              <SkillsInput
                label={t('ideas.skillsFilterPlaceholder')}
                supportingText={t('ideas.skillsFilterHint')}
                value={skills}
                onChange={setSkills}
                options={skillOptions}
                className="im__skills-input"
              />
            </div>

            <div className="im__stage-row">
              <div className="im__filter im__filter--stage">
                <span className="im__filter-label">{t('ideas.ideaStage')}</span>
                <div className="im__stages" role="group" aria-label={t('ideas.ideaStage')}>
                  {STAGE_FILTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`im__stage${stage === s ? ' im__stage--active' : ''}`}
                      onClick={() => setStage(s)}
                    >
                      {s === 'all' ? t('ideas.stageAll') : t(STAGE_LABEL[s])}
                    </button>
                  ))}
                </div>
              </div>

              {hasFilters && (
                <button type="button" className="im__clear" onClick={clearFilters}>
                  {t('ideas.clearFilters')}
                </button>
              )}
            </div>
          </section>

          <p className="im__count">
            {t('ideas.showing', { shown: visible.length, total: ideas.length })}
          </p>

          {/* Idea cards */}
          <div className="im__cards">
            {visible.map((p) => (
              <article key={p.id} className="im__card">
                <div className="im__owner">
                  <span className="im__owner-avatar" aria-hidden="true">
                    {p.owner?.avatar_url ? (
                      <img src={p.owner.avatar_url} alt="" className="im__owner-img" />
                    ) : (
                      <UserRound width={26} height={26} />
                    )}
                  </span>
                  <div className="im__owner-info">
                    <span className="im__owner-label">{t('ideas.owner')}</span>
                    <span className="im__owner-name">
                      {p.owner ? (i18n.language === 'ar' ? p.owner.name_ar : p.owner.name_en) : '—'}
                    </span>
                    {p.owner?.job_title && <span className="im__owner-role">{p.owner.job_title}</span>}
                  </div>
                </div>

                <div className="im__summary">
                  <span className="im__summary-label">{t('ideas.summary')}</span>
                  <h2 className="im__card-title">{p.title}</h2>
                  <div className="im__skills">
                    {(p.skills || []).slice(0, MAX_CARD_SKILLS).map((s) => (
                      <span key={s.id} className="im__skill">{s.name}</span>
                    ))}
                    {(p.skills || []).length > MAX_CARD_SKILLS && (
                      <span className="im__skill im__skill--more">
                        +{p.skills.length - MAX_CARD_SKILLS}
                      </span>
                    )}
                  </div>
                </div>

                <div className="im__pills">
                  <span className="im__pill im__pill--stage">
                    <Flag width={14} height={14} aria-hidden="true" />
                    {t(STAGE_LABEL[p.stage] || STAGE_LABEL.planning)}
                  </span>
                  <span className="im__pill">
                    <UserCheck width={16} height={16} aria-hidden="true" />
                    {t('myProjects.opening', { count: p.team_members_needed })}
                  </span>
                  {industryName(p.industry_id) && (
                    <span className="im__pill">
                      <Building width={14} height={14} aria-hidden="true" />
                      {industryName(p.industry_id)}
                    </span>
                  )}
                </div>

                <hr className="im__divider" />

                <div className="im__card-foot">
                  <span className="im__posted">
                    {t('myProjects.postedDaysAgo', { count: daysSince(p.created_at) })}
                  </span>
                  <button type="button" className="im__details" onClick={() => navigate(`/ideas/${p.id}`)}>
                    {t('ideas.viewDetails')}
                    <List width={18} height={18} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>

          {!loading && visible.length === 0 && <p className="im__empty">{t('ideas.empty')}</p>}
        </main>
      </div>
    </div>
  );
}
