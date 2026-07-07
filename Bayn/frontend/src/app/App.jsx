import { useState } from 'react';
import LoginPage  from '@/features/identity/pages/LoginPage';
import SignUpPage from '@/features/identity/pages/SignUpPage';
import HomePage   from '@/features/home/pages/HomePage';

export default function App() {
  const [page, setPage] = useState('home');
  return (
    <>
      {page === 'login'  && <LoginPage  onNavigate={setPage} />}
      {page === 'signup' && <SignUpPage onNavigate={setPage} />}
      {page === 'home'   && <HomePage   onNavigate={setPage} />}
    </>
  );
}
