import { useTranslation } from 'react-i18next';
import { fmtCount } from '../lib/format';
import './StatsBand.css';

export default function StatsBand({ stats }) {
  const { t } = useTranslation();

  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="band reveal">
          <div className="band-glow" />
          <div className="wrapx">
            <div className="band-stat"><b>{fmtCount(stats.users)}</b><span>{t('landing.stats.builders')}</span></div>
            <div className="band-stat"><b>{fmtCount(stats.ideas)}</b><span>{t('landing.stats.ideas')}</span></div>
            <div className="band-stat"><b>{fmtCount(stats.teams)}</b><span>{t('landing.stats.teams')}</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}
