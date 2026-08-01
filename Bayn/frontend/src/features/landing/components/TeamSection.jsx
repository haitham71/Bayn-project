import { useTranslation } from 'react-i18next';
import UserRound from '@/assets/icons/user-round.svg?react';
import './TeamSection.css';

// Names come from the locale files so the section reads in whichever language
// the visitor is on. One silhouette throughout — the tone is what tells the
// four apart.
const MEMBERS = [
  { key: 'm1', tone: 'var(--green-deep)' },
  { key: 'm2', tone: 'var(--green)' },
  { key: 'm3', tone: 'var(--brown)' },
  { key: 'm4', tone: 'var(--muted)' },
];

export default function TeamSection() {
  const { t } = useTranslation();

  return (
    <section className="section" style={{ paddingTop: 0 }} id="team">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="eyebrow" style={{ justifyContent: 'center' }}>{t('landing.team.eyebrow')}</span>
          <h2>{t('landing.team.title')}</h2>
          <p className="lead">{t('landing.team.lead')}</p>
        </div>
        <div className="team">
          {MEMBERS.map(({ key, tone }) => (
            <div key={key} className="member reveal">
              <span className="member-av" style={{ background: tone }}>
                <UserRound width={38} height={38} aria-hidden="true" />
              </span>
              <b>{t(`landing.team.${key}`)}</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
