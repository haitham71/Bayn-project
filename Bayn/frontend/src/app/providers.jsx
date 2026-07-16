import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/shared/i18n/i18n';

// One client for the whole app. Profile/catalog data changes rarely, so we
// keep it fresh for 5 minutes — remounting a page reads from the cache instead
// of hitting the API again, and concurrent callers share a single request.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Wraps the app with shared context providers: query cache, i18n and the router.
export default function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>{children}</BrowserRouter>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
