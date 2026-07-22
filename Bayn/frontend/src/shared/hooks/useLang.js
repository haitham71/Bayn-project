import { useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SUPPORTED_LANGS, detectLang } from '@/shared/i18n/i18n';

// The active language taken from the URL's /:lang prefix (falls back to the
// detected default outside the routed tree).
export function useCurrentLang() {
  const { lang } = useParams();
  return SUPPORTED_LANGS.includes(lang) ? lang : detectLang();
}

// Drop-in replacement for useNavigate that keeps every absolute path under the
// current /:lang prefix, so navigation never leaves the localized routes.
export function useLangNavigate() {
  const navigate = useNavigate();
  const lang = useCurrentLang();
  return useCallback(
    (to, opts) => {
      if (typeof to === 'string' && to.startsWith('/')) {
        navigate(`/${lang}${to === '/' ? '' : to}`, opts);
      } else {
        navigate(to, opts);
      }
    },
    [navigate, lang],
  );
}

// Toggle between Arabic and English, swapping the prefix on the current URL so
// the user stays on the same page (and the query string is preserved).
export function useLangSwitch() {
  const navigate = useNavigate();
  const location = useLocation();
  const lang = useCurrentLang();
  return useCallback(() => {
    const next = lang === 'ar' ? 'en' : 'ar';
    const rest = location.pathname.replace(/^\/(ar|en)(?=\/|$)/, '');
    navigate(`/${next}${rest}${location.search}`);
  }, [navigate, location, lang]);
}
