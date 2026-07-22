import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { isAuthenticated } from '@/shared/lib/authToken';
import PageLoader from '@/shared/components/PageLoader';

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
// URL so the page components don't need to know about routing.
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

export default function App() {
  const navigate = useNavigate();
  const [signupData, setSignupData] = useState({});

  // Same onNavigate(key) API the pages already use, now backed by the router.
  const goTo = (key) => navigate(PATHS[key] || '/login');

  // Merge each step's slice so pages only touch their own fields and never
  // clobber values captured on the other steps.
  const patchData = (patch) => setSignupData((prev) => ({ ...prev, ...patch }));

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
      {/* Public landing page; signed-in visitors go straight to their home. */}
      <Route path="/" element={isAuthenticated() ? <Navigate to="/home" replace /> : <LandingPage />} />
      <Route path="/login" element={<LoginPage onNavigate={goTo} />} />
      <Route
        path="/signup"
        element={<SignUpPage onNavigate={goTo} initialData={signupData} onDataChange={patchData} />}
      />
      <Route
        path="/verification"
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
        path="/profile-setup"
        element={<ProfileSetupPage onNavigate={goTo} initialData={signupData} onDataChange={patchData} />}
      />
      <Route path="/confirm-password-change" element={<ConfirmPasswordChangePage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage onNavigate={goTo} />} />
      <Route path="/reset-password" element={<ResetPasswordPage onNavigate={goTo} />} />
      <Route path="/home" element={<ProtectedRoute><HomePage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="/ideas" element={<ProtectedRoute><IdeasMarketplacePage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="/ideas/:id" element={<ProtectedRoute><IdeaDetailsPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="/my-profile" element={<ProtectedRoute><MyProfilePage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="/my-projects" element={<ProtectedRoute><MyProjectsPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="/meetings" element={<ProtectedRoute><MeetingsPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="/meeting/:id" element={<ProtectedRoute><MeetingRoomPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="/join-requests" element={<ProtectedRoute><JoinRequestsPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="/join-requests/:projectId" element={<ProtectedRoute><JoinRequestsPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="/create-idea" element={<ProtectedRoute><CreateIdeaPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="/edit-idea/:id" element={<ProtectedRoute><EditIdeaPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="/projects/dashboard" element={<ProtectedRoute><ProjectDashboardPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="/projects/:projectId/dashboard" element={<ProtectedRoute><ProjectDashboardPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
