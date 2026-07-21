import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '@/shared/lib/authToken';

// Gate for pages that need a signed-in user. Without a token we bounce the
// visitor to /login instead of rendering the page, so typing an app URL
// (e.g. /home) directly in the address bar can't bypass authentication.
export default function ProtectedRoute({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
