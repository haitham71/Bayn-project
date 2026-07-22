import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '@/shared/lib/authToken';
import { useCurrentLang } from '@/shared/hooks/useLang';

// Gate for pages that need a signed-in user. Without a token we bounce the
// visitor to /:lang/login instead of rendering the page, so typing an app URL
// (e.g. /ar/home) directly in the address bar can't bypass authentication.
export default function ProtectedRoute({ children }) {
  const lang = useCurrentLang();
  if (!isAuthenticated()) {
    return <Navigate to={`/${lang}/login`} replace />;
  }
  return children;
}
