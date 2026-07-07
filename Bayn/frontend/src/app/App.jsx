import { useState } from 'react';
import LoginPage        from '@/features/identity/pages/LoginPage';
import SignUpPage       from '@/features/identity/pages/SignUpPage';
import VerificationPage from '@/features/identity/pages/VerificationPage';
import HomePage         from '@/features/home/pages/HomePage';

const PAGE_KEY = 'bayn-page';
const PAGES = ['login', 'signup', 'verification', 'home'];

function readPage() {
  try {
    const saved = localStorage.getItem(PAGE_KEY);
    return PAGES.includes(saved) ? saved : 'login';
  } catch {
    return 'login';
  }
}

export default function App() {
  const [page, setPage] = useState(readPage);
  const [signupData, setSignupData] = useState({});

  const goTo = (next) => {
    setPage(next);
    try {
      localStorage.setItem(PAGE_KEY, next);
    } catch {}
  };

  return (
    <>
      {page === 'login'        && <LoginPage onNavigate={goTo} />}
      {page === 'signup'       && <SignUpPage onNavigate={goTo} initialData={signupData} onDataChange={setSignupData} />}
      {page === 'verification' && <VerificationPage onEditInfo={() => goTo('signup')} />}
      {page === 'home'         && <HomePage onNavigate={goTo} />}
    </>
  );
}
