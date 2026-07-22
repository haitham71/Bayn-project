import api from '@/shared/lib/axios';
import { API } from '@/shared/constants/apiEndpoints';

// Public platform-wide counts shown on the landing page (users, ideas, teams).
export const getAnalyticsOverview = () =>
  api.get(API.analytics.overview).then((r) => r.data);
