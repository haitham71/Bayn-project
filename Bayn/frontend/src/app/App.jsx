import { useState } from 'react';
import LoginPage  from '@/features/identity/pages/LoginPage';
import SignUpPage from '@/features/identity/pages/SignUpPage';
 
export default function App() {
  const [page, setPage] = useState('login');
  return (
    <>
      {page === 'login'  && <LoginPage  onNavigate={setPage} />}
      {page === 'signup' && <SignUpPage onNavigate={setPage} />}
    </>
  );
}