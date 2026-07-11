import { useState } from 'react';
import LoginPage        from '@/features/identity/pages/LoginPage';
import SignUpPage       from '@/features/identity/pages/SignUpPage';
import VerificationPage from '@/features/identity/pages/VerificationPage';
import ProfileSetupPage from '@/features/identity/pages/ProfileSetupPage';
import HomePage         from '@/features/home/pages/HomePage';
import MyProfilePage    from '@/features/profile/pages/MyProfilePage';
import MyProjectsPage   from '@/features/projects/pages/MyProjectsPage';
import CreateIdeaPage   from '@/features/ideas/pages/CreateIdeaPage';

const PAGE_KEY = 'bayn-page';
const PAGES = ['login', 'signup', 'verification', 'profile', 'home', 'myprofile', 'myprojects', 'createidea'];

function readPage() {
  try {
    const saved = localStorage.getItem(PAGE_KEY);
    return PAGES.includes(saved) ? saved : 'login';
  } catch {
    return 'home';
  }
}

export default function App() {
  const [page, setPage] = useState('myprojects');
  const [signupData, setSignupData] = useState({});

  const goTo = (next) => {
    setPage(next);
    try {
      localStorage.setItem(PAGE_KEY, next);
    } catch {}
  };

  // Merge each step's slice so pages only touch their own fields and never
  // clobber values captured on the other steps.
  const patchData = (patch) => setSignupData((prev) => ({ ...prev, ...patch }));

  return (
    <>
      {page === 'login'        && <LoginPage onNavigate={goTo} />}
      {page === 'signup'       && <SignUpPage onNavigate={goTo} initialData={signupData} onDataChange={patchData} />}
      {page === 'verification' && (
        <VerificationPage
          email={signupData.email}
          phone={signupData.phone}
          onEditInfo={() => goTo('signup')}
          onNext={() => goTo('profile')}
        />
      )}
      {page === 'profile'      && <ProfileSetupPage onNavigate={goTo} initialData={signupData} onDataChange={patchData} />}
      {page === 'home'         && <HomePage onNavigate={goTo} />}
      {page === 'myprofile'    && <MyProfilePage onNavigate={goTo} />}
      {page === 'myprojects'   && <MyProjectsPage onNavigate={goTo} />}
      {page === 'createidea'   && <CreateIdeaPage onNavigate={goTo} />}
    </>
  );
}
