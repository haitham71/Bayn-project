import { useLangNavigate, useCurrentLang } from '@/shared/hooks/useLang';

// A link that opens a legal page inside the SPA. Renders a real (lang-prefixed)
// href so right-click / ctrl-click open a new tab, but a plain click navigates
// in-app and keeps the active /:lang prefix. `fromCrumb` is carried in the
// navigation state so the destination's breadcrumb points back to the origin
// page instead of always falling back to the home page.
export function LegalLink({ to, fromCrumb, className, children }) {
  const navigate = useLangNavigate();
  const lang = useCurrentLang();
  return (
    <a
      className={className}
      href={`/${lang}${to}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to, fromCrumb ? { state: { crumb: fromCrumb } } : undefined);
      }}
    >
      {children}
    </a>
  );
}
