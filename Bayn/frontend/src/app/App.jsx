import { useState } from 'react';
import LoginPage from '@/features/identity/pages/LoginPage';
import SignUpPage from '@/features/identity/pages/SignUpPage';
import VerificationPage from '@/features/identity/pages/VerificationPage';

const PAGE_KEY = 'bayn-page';
const PAGES = ['login', 'signup', 'verification'];

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
  // Held here (not inside SignUpPage) so the entered data survives navigating
  // away to verification and back via "Edit information".
  const [signupData, setSignupData] = useState({});

  // Remember the current page so a refresh keeps the user where they were.
  const goTo = (next) => {
    setPage(next);
    try {
      localStorage.setItem(PAGE_KEY, next);
    } catch {
      // storage unavailable (private mode) — ignore
    }
  };

  return (
    <>
      {page === 'login' && <LoginPage onNavigate={goTo} />}
      {page === 'signup' && (
        <SignUpPage onNavigate={goTo} initialData={signupData} onDataChange={setSignupData} />
      )}
      {page === 'verification' && (
        <VerificationPage onEditInfo={() => goTo('signup')} />
      )}
    </>
  );
}
