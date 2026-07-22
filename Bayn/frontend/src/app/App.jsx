import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { isAuthenticated } from '@/shared/lib/authToken';
import PageLoader from '@/shared/components/PageLoader';
import i18n, { SUPPORTED_LANGS, detectLang } from '@/shared/i18n/i18n';

// The public landing page is the first paint, so keep it eager (no chunk flash).
import LandingPage from '@/features/landing/pages/LandingPage';

// Every other page is code-split — its chunk is only fetched when its route is
// first visited, keeping the initial bundle small.
const LoginPage = lazy(() => import('@/features/identity/pages/LoginPage'));
const SignUpPage = lazy(() => import('@/features/identity/pages/SignUpPage'));
const VerificationPage = lazy(() => import('@/features/identity/pages/VerificationPage'));
const ProfileSetupPage = lazy(() => import('@/features/identity/pages/ProfileSetupPage'));
const ConfirmPasswordChangePage = lazy(() => import('@/features/identity/pages/ConfirmPasswordChangePage'));
const ForgotPasswordPage = lazy(() => import('@/features/identity/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/identity/pages/ResetPasswordPage'));
const HomePage = lazy(() => import('@/features/home/pages/Homepage'));
const MyProfilePage = lazy(() => import('@/features/profile/pages/MyProfilePage'));
const MyProjectsPage = lazy(() => import('@/features/projects/pages/MyProjectsPage'));
const JoinRequestsPage = lazy(() => import('@/features/projects/pages/JoinRequestsPage'));
const ProjectDashboardPage = lazy(() => import('@/features/dashboard/pages/ProjectDashboard'));
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage'));
const CreateIdeaPage = lazy(() => import('@/features/ideas/pages/CreateIdeaPage'));
const EditIdeaPage = lazy(() => import('@/features/ideas/pages/EditIdeaPage'));
const IdeasMarketplacePage = lazy(() => import('@/features/ideas/pages/IdeasMarketplacePage'));
const IdeaDetailsPage = lazy(() => import('@/features/ideas/pages/IdeaDetailsPage'));
const MeetingsPage = lazy(() => import('@/features/meetings/pages/MeetingsPage'));
// Pulls in the heavy Daily SDK only when a user actually opens a meeting.
const MeetingRoomPage = lazy(() => import('@/features/meetings/pages/MeetingRoomPage'));

// Pages navigate with short keys (onNavigate('home')); this maps each key to its
// (language-less) URL. goTo() prepends the active /:lang prefix.
const PATHS = {
  login: '/login',
  signup: '/signup',
  verification: '/verification',
  profile: '/profile-setup',
  forgotPassword: '/forgot-password',
  home: '/home',
  ideas: '/ideas',
  myprofile: '/my-profile',
  myprojects: '/my-projects',
  joinrequests: '/join-requests',
  meetings: '/meetings',
  createidea: '/create-idea',
  dashboard: '/projects/dashboard',
  settings: '/settings',
};

// All the app's routes, mounted under /:lang. The active language is driven by
// the URL prefix — visiting /ar/... or /en/... sets i18next accordingly.
function LangApp() {
  const { lang, '*': splat } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [signupData, setSignupData] = useState({});

  const isSupported = SUPPORTED_LANGS.includes(lang);

  // Keep i18next in sync with the URL's language.
  useEffect(() => {
    if (isSupported && i18n.language !== lang) i18n.changeLanguage(lang);
  }, [isSupported, lang]);

  // A missing/unknown prefix (e.g. an old /login link or /ideas/5 without a
  // language) is treated as a real path and redirected under the detected
  // language, preserving the rest of the path and the query string.
  if (!isSupported) {
    const rebuilt = `/${lang}${splat ? `/${splat}` : ''}`;
    return <Navigate to={`/${detectLang()}${rebuilt}${location.search}`} replace />;
  }

  const goTo = (key) => navigate(`/${lang}${PATHS[key] || '/login'}`);
  const patchData = (patch) => setSignupData((prev) => ({ ...prev, ...patch }));

  return (
    <Routes>
      {/* Public landing page; signed-in visitors go straight to their home. */}
      <Route path="" element={isAuthenticated() ? <Navigate to="home" replace /> : <LandingPage />} />
      <Route path="login" element={<LoginPage onNavigate={goTo} />} />
      <Route
        path="signup"
        element={<SignUpPage onNavigate={goTo} initialData={signupData} onDataChange={patchData} />}
      />
      <Route
        path="verification"
        element={(
          <VerificationPage
            email={signupData.email}
            phone={signupData.phone}
            pendingToken={signupData.pendingToken}
            onEditInfo={() => goTo('signup')}
            onNext={() => goTo('profile')}
          />
        )}
      />
      <Route
        path="profile-setup"
        element={<ProfileSetupPage onNavigate={goTo} initialData={signupData} onDataChange={patchData} />}
      />
      <Route path="confirm-password-change" element={<ConfirmPasswordChangePage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage onNavigate={goTo} />} />
      <Route path="reset-password" element={<ResetPasswordPage onNavigate={goTo} />} />
      <Route path="home" element={<ProtectedRoute><HomePage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="ideas" element={<ProtectedRoute><IdeasMarketplacePage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="ideas/:id" element={<ProtectedRoute><IdeaDetailsPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="my-profile" element={<ProtectedRoute><MyProfilePage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="my-projects" element={<ProtectedRoute><MyProjectsPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="meetings" element={<ProtectedRoute><MeetingsPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="meeting/:id" element={<ProtectedRoute><MeetingRoomPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="join-requests" element={<ProtectedRoute><JoinRequestsPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="join-requests/:projectId" element={<ProtectedRoute><JoinRequestsPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="create-idea" element={<ProtectedRoute><CreateIdeaPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="edit-idea/:id" element={<ProtectedRoute><EditIdeaPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="projects/dashboard" element={<ProtectedRoute><ProjectDashboardPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="projects/:projectId/dashboard" element={<ProtectedRoute><ProjectDashboardPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="settings" element={<ProtectedRoute><SettingsPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/:lang/*" element={<LangApp />} />
        {/* No language in the URL — send the visitor to their detected language. */}
        <Route path="*" element={<Navigate to={`/${detectLang()}`} replace />} />
      </Routes>
    </Suspense>
  );
}
