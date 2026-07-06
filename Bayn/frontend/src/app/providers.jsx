import { I18nextProvider } from 'react-i18next';
import i18n from '@/shared/i18n/i18n';

// Wraps the app with shared context providers (i18n for now).
export default function Providers({ children }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
