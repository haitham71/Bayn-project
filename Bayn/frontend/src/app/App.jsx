import { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LoginPage        from '@/features/identity/pages/LoginPage';
import SignUpPage       from '@/features/identity/pages/SignUpPage';
import VerificationPage from '@/features/identity/pages/VerificationPage';
import ProfileSetupPage from '@/features/identity/pages/ProfileSetupPage';
import ConfirmPasswordChangePage from '@/features/identity/pages/ConfirmPasswordChangePage';
import ForgotPasswordPage from '@/features/identity/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/features/identity/pages/ResetPasswordPage';
import HomePage         from '@/features/home/pages/Homepage';
import MyProfilePage    from '@/features/profile/pages/MyProfilePage';
import MyProjectsPage   from '@/features/projects/pages/MyProjectsPage';
import JoinRequestsPage from '@/features/projects/pages/JoinRequestsPage';
import CreateIdeaPage   from '@/features/ideas/pages/CreateIdeaPage';
import IdeasMarketplacePage from '@/features/ideas/pages/IdeasMarketplacePage';
import IdeaDetailsPage from '@/features/ideas/pages/IdeaDetailsPage';
import ProtectedRoute    from '@/shared/components/ProtectedRoute';

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
  createidea: '/create-idea',
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
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
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
      <Route path="/join-requests" element={<ProtectedRoute><JoinRequestsPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="/create-idea" element={<ProtectedRoute><CreateIdeaPage onNavigate={goTo} /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
