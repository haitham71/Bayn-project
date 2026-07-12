import { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LoginPage        from '@/features/identity/pages/LoginPage';
import SignUpPage       from '@/features/identity/pages/SignUpPage';
import VerificationPage from '@/features/identity/pages/VerificationPage';
import ProfileSetupPage from '@/features/identity/pages/ProfileSetupPage';
import HomePage         from '@/features/home/pages/Homepage';
import MyProfilePage    from '@/features/profile/pages/MyProfilePage';
import MyProjectsPage   from '@/features/projects/pages/MyProjectsPage';
import JoinRequestsPage from '@/features/projects/pages/JoinRequestsPage';
import CreateIdeaPage   from '@/features/ideas/pages/CreateIdeaPage';

// Pages navigate with short keys (onNavigate('home')); this maps each key to its
// URL so the page components don't need to know about routing.
const PATHS = {
  login: '/login',
  signup: '/signup',
  verification: '/verification',
  profile: '/profile-setup',
  home: '/home',
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
      <Route path="/home" element={<HomePage onNavigate={goTo} />} />
      <Route path="/my-profile" element={<MyProfilePage onNavigate={goTo} />} />
      <Route path="/my-projects" element={<MyProjectsPage onNavigate={goTo} />} />
      <Route path="/join-requests" element={<JoinRequestsPage onNavigate={goTo} />} />
      <Route path="/create-idea" element={<CreateIdeaPage onNavigate={goTo} />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
