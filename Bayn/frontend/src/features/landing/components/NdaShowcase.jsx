import { useTranslation } from 'react-i18next';
import Check from '@/assets/icons/check.svg?react';
import FileText from '@/assets/icons/file-text.svg?react';
import Tick from './Tick';
import './MockPanel.css';
import './Showcase.css';
import './NdaShowcase.css';

// The NDA is raised automatically with every meeting request, so the panel
// mirrors a contract that both parties have already signed.
export default function NdaShowcase() {
  const { t } = useTranslation();

  return (
    <section className="section" style={{ paddingTop: 0 }} id="nda">
      <div className="wrap">
        <div className="showcase-grid">
          <div className="reveal">
            <span className="eyebrow">{t('landing.nda.eyebrow')}</span>
            <h2 style={{ margin: '14px 0 4px' }}>{t('landing.nda.title')}</h2>
            <p className="lead">{t('landing.nda.lead')}</p>
            <ul className="feat-list">
              <li><Tick />{t('landing.nda.point1')}</li>
              <li><Tick />{t('landing.nda.point2')}</li>
              <li><Tick />{t('landing.nda.point3')}</li>
            </ul>
          </div>
          <div className="panel reveal">
            <div className="mk-head">
              <div>
                <div className="mk-title">{t('landing.nda.docTitle')}</div>
                <div className="mk-sub">{t('landing.nda.docMeta')}</div>
              </div>
              <span className="chip">{t('landing.nda.statusSigned')}</span>
            </div>
            <div className="mk-rows">
              <div className="mk-row">
                <div className="mk-av" style={{ background: '#295e4d' }}>
                  {t('landing.nda.party1').trim().charAt(0)}
                </div>
                <div className="t">
                  <b>{t('landing.nda.party1')}</b>
                  <span>{t('landing.nda.party1Role')}</span>
                </div>
                <span className="nda-sig">
                  <Check width={11} height={11} aria-hidden="true" />
                  {t('landing.nda.signedOn1')}
                </span>
              </div>
              <div className="mk-row">
                <div className="mk-av" style={{ background: '#786c57' }}>
                  {t('landing.nda.party2').trim().charAt(0)}
                </div>
                <div className="t">
                  <b>{t('landing.nda.party2')}</b>
                  <span>{t('landing.nda.party2Role')}</span>
                </div>
                <span className="nda-sig">
                  <Check width={11} height={11} aria-hidden="true" />
                  {t('landing.nda.signedOn2')}
                </span>
              </div>
            </div>
            <div className="nda-terms">
              <span className="nda-term">
                <FileText width={13} height={13} aria-hidden="true" />
                {t('landing.nda.pdf')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
