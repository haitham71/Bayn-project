import { useLocation } from 'react-router-dom';
import { useLangNavigate } from '@/shared/hooks/useLang';
import BaynLogo from '@/assets/logo/Bayn-svg.svg?react';
import ArrowRight from '@/assets/icons/arrow-right.svg?react';
import '../Legal.css';

// Re-exported for convenience so the legal pages can pull the layout and the
// link helper from one place.
export { LegalLink } from './LegalLink';

// Shared chrome for the legal pages (privacy policy + user agreement). These are
// Saudi legal documents, so the whole layout is Arabic/RTL regardless of the
// app's active language. The page passes its title, meta, notice, table of
// contents and section body as props/children; everything else is identical.
export default function LegalLayout({
  eyebrow = 'الوثائق النظامية',
  title,
  breadcrumb,
  lastUpdated,
  notice,
  toc = [],
  showBack = true,
  children,
}) {
  const navigate = useLangNavigate();
  const location = useLocation();
  const goHome = () => navigate('/');
  // First breadcrumb reflects where the user came from (passed in navigation
  // state), falling back to the home page on a direct visit.
  const crumb = location.state?.crumb || { label: 'الرئيسية', to: '/' };

  return (
    <div className="lg" dir="rtl" lang="ar">
      <header className="lg__header">
        <div className="lg__wrap">
          <nav className="lg__nav">
            <button type="button" className="lg__brand" onClick={goHome} aria-label="بين">
              <BaynLogo aria-hidden="true" />
              <span className="lg__brand-name">بين</span>
            </button>
            {showBack && (
              <button type="button" className="lg__back" onClick={goHome}>
                <ArrowRight width={16} height={16} aria-hidden="true" />
                العودة للرئيسية
              </button>
            )}
          </nav>
        </div>
      </header>

      <div className="lg__wrap">
        {/* Breadcrumbs */}
        <nav className="lg__crumbs" aria-label="مسار التنقّل">
          <button type="button" onClick={() => navigate(crumb.to)}>{crumb.label}</button>
          <span className="lg__sep" aria-hidden="true">/</span>
          <span className="lg__current" aria-current="page">{breadcrumb}</span>
        </nav>

        <div className="lg__hero">
          <div className="lg__eyebrow">{eyebrow}</div>
          <h1 className="lg__title">{title}</h1>
          {lastUpdated && <div className="lg__meta">آخر تحديث: {lastUpdated}</div>}
          {notice && <div className="lg__notice">{notice}</div>}

          {toc.length > 0 && (
            <div className="lg__toc">
              <span className="lg__toc-title">المحتويات</span>
              <ol>
                {toc.map((item) => (
                  <li key={item.id}><a href={`#${item.id}`}>{item.label}</a></li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      <main className="lg__wrap lg__main">
        {children}
      </main>

      <footer className="lg__footer">
        <div className="lg__wrap">
          <span>© 2026 بين. جميع الحقوق محفوظة.</span>
          <button type="button" onClick={goHome}>الرئيسية</button>
        </div>
      </footer>
    </div>
  );
}
