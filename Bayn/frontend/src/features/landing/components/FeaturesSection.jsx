import { useTranslation } from 'react-i18next';
import Check from '@/assets/icons/check.svg?react';
import X from '@/assets/icons/x.svg?react';
import Video from '@/assets/icons/video.svg?react';
import Lightbulb from '@/assets/icons/lightbulb.svg?react';
import Users from '@/assets/icons/users.svg?react';
import LayoutDashboard from '@/assets/icons/layout-dashboard.svg?react';
import Calendar from '@/assets/icons/calendar.svg?react';
import User from '@/assets/icons/user.svg?react';
import CirclePlay from '@/assets/icons/circle-play.svg?react';
import Play from '@/assets/icons/play.svg?react';
import './FeaturesSection.css';

// Initial-letter avatar for the feature mockups. The letter comes off the
// translated name, so it follows the language instead of being hard-coded.
function Av({ name, tone }) {
  return (
    <span className="peek-av" style={{ background: tone }}>
      {(name || '').trim().charAt(0)}
    </span>
  );
}

export default function FeaturesSection() {
  const { t } = useTranslation();

  return (
    <section className="section" id="features">
      <div className="wrap">
        <div className="sec-head reveal">
          <span className="eyebrow" style={{ justifyContent: 'center' }}>{t('landing.features.eyebrow')}</span>
          <h2>{t('landing.features.title')}</h2>
          <p className="lead">{t('landing.features.lead')}</p>
        </div>
        {/* Every card carries a scaled-down mock of the screen it describes.
            The mocks are decorative and use sample data, so they stay out of
            the accessibility tree. */}
        <div className="features">
          <div className="card reveal">
            <div className="ico"><Lightbulb width={24} height={24} aria-hidden="true" /></div>
            <h3>{t('landing.features.marketplaceTitle')}</h3>
            <p>{t('landing.features.marketplaceDesc')}</p>
            <div className="peek" aria-hidden="true">
              <div className="peek-filters">
                <span className="peek-chip on">{t('landing.features.peek.stageMvp')}</span>
                <span className="peek-chip">{t('landing.features.peek.stageIdea')}</span>
                <span className="peek-results">{t('landing.features.peek.results')}</span>
              </div>
              <div className="peek-row">
                <Av name={t('landing.features.peek.ideaOwner')} tone="var(--green)" />
                <div className="peek-txt">
                  <b>{t('landing.features.peek.ideaTitle')}</b>
                  <span>{t('landing.features.peek.ideaOwner')}</span>
                </div>
                <span className="peek-go">{t('landing.features.peek.details')}</span>
              </div>
              <div className="peek-row dim">
                <Av name={t('landing.features.peek.ideaOwner2')} tone="var(--brown)" />
                <div className="peek-txt">
                  <b>{t('landing.features.peek.ideaTitle2')}</b>
                  <span>{t('landing.features.peek.ideaOwner2')}</span>
                </div>
                <span className="peek-go">{t('landing.features.peek.details')}</span>
              </div>
            </div>
          </div>
          <div className="card reveal">
            <div className="ico"><Users width={24} height={24} aria-hidden="true" /></div>
            <h3>{t('landing.features.teamTitle')}</h3>
            <p>{t('landing.features.teamDesc')}</p>
            <div className="peek" aria-hidden="true">
              <span className="peek-head">{t('landing.features.peek.requests')}</span>
              <div className="peek-row">
                <Av name={t('landing.features.peek.reqName')} tone="var(--green-deep)" />
                <div className="peek-txt">
                  <b>{t('landing.features.peek.reqName')}</b>
                  <span>{t('landing.features.peek.reqRole')}</span>
                </div>
                <span className="peek-act ok"><Check width={12} height={12} /></span>
                <span className="peek-act no"><X width={12} height={12} /></span>
              </div>
              <div className="peek-row dim">
                <Av name={t('landing.features.peek.reqName2')} tone="var(--muted)" />
                <div className="peek-txt">
                  <b>{t('landing.features.peek.reqName2')}</b>
                  <span>{t('landing.features.peek.reqRole2')}</span>
                </div>
                <span className="peek-act ok"><Check width={12} height={12} /></span>
                <span className="peek-act no"><X width={12} height={12} /></span>
              </div>
            </div>
          </div>
          <div className="card reveal">
            <div className="ico"><LayoutDashboard width={24} height={24} aria-hidden="true" /></div>
            <h3>{t('landing.features.dashboardTitle')}</h3>
            <p>{t('landing.features.dashboardDesc')}</p>
            <div className="peek peek-board" aria-hidden="true">
              <div className="peek-col">
                <span className="peek-col-h">{t('landing.features.peek.todo')}<i>3</i></span>
                <span className="peek-task"><span className="peek-bar" /><span className="peek-dot" /></span>
                <span className="peek-task"><span className="peek-bar short" /><span className="peek-dot alt" /></span>
              </div>
              <div className="peek-col">
                <span className="peek-col-h">{t('landing.features.peek.doing')}<i>2</i></span>
                <span className="peek-task"><span className="peek-bar" /><span className="peek-dot alt" /></span>
              </div>
              <div className="peek-col">
                <span className="peek-col-h">{t('landing.features.peek.done')}<i>7</i></span>
                <span className="peek-task done"><span className="peek-bar short" /><span className="peek-dot" /></span>
                <span className="peek-task done"><span className="peek-bar" /><span className="peek-dot alt" /></span>
              </div>
            </div>
          </div>
          <div className="card reveal">
            <div className="ico"><Calendar width={24} height={24} aria-hidden="true" /></div>
            <h3>{t('landing.features.meetingsTitle')}</h3>
            <p>{t('landing.features.meetingsDesc')}</p>
            <div className="peek" aria-hidden="true">
              <div className="peek-meet">
                <span className="peek-when">{t('landing.features.peek.meetingWhen')}</span>
                <b>{t('landing.features.peek.meetingTitle')}</b>
                <div className="peek-foot">
                  <span className="peek-stack">
                    <Av name={t('landing.features.peek.reqName')} tone="var(--green-deep)" />
                    <Av name={t('landing.features.peek.profileName')} tone="var(--green)" />
                    <Av name={t('landing.features.peek.ideaOwner')} tone="var(--brown)" />
                  </span>
                  <span className="peek-join">
                    <Video width={12} height={12} />
                    {t('landing.features.peek.join')}
                  </span>
                </div>
              </div>
              <div className="peek-meet dim">
                <span className="peek-when">{t('landing.features.peek.meetingWhen2')}</span>
                <b>{t('landing.features.peek.meetingTitle2')}</b>
              </div>
            </div>
          </div>
          <div className="card reveal">
            <div className="ico"><CirclePlay width={24} height={24} aria-hidden="true" /></div>
            <h3>{t('landing.features.recordingTitle')}</h3>
            <p>{t('landing.features.recordingDesc')}</p>
            <div className="peek" aria-hidden="true">
              <div className="peek-rec">
                <span className="peek-play"><Play width={11} height={11} /></span>
                <div className="peek-txt">
                  <b>{t('landing.features.peek.recTitle')}</b>
                  <span>{t('landing.features.peek.recWhen')}</span>
                </div>
                <span className="peek-dur">42:18</span>
              </div>
              <div className="peek-rec dim">
                <span className="peek-play"><Play width={11} height={11} /></span>
                <div className="peek-txt">
                  <b>{t('landing.features.peek.recTitle2')}</b>
                  <span>{t('landing.features.peek.recWhen2')}</span>
                </div>
                <span className="peek-dur">28:05</span>
              </div>
            </div>
          </div>
          <div className="card reveal">
            <div className="ico"><User width={24} height={24} aria-hidden="true" /></div>
            <h3>{t('landing.features.profilesTitle')}</h3>
            <p>{t('landing.features.profilesDesc')}</p>
            <div className="peek peek-prof" aria-hidden="true">
              <Av name={t('landing.features.peek.profileName')} tone="var(--green)" />
              <b>{t('landing.features.peek.profileName')}</b>
              <span className="peek-role">{t('landing.features.peek.profileRole')}</span>
              <div className="peek-tags">
                <span>React</span>
                <span>FastAPI</span>
                <span>Figma</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
