import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/shared/i18n/i18n';

// Wraps the app with shared context providers: i18n and the router.
export default function Providers({ children }) {
  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>{children}</BrowserRouter>
    </I18nextProvider>
  );
}
