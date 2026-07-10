import axios from 'axios';
import i18n from '@/shared/i18n/i18n';
import { API } from '@/shared/constants/apiEndpoints';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './authToken';

// Wires request/response interceptors onto the shared axios instance:
//  - request: attach the bearer token + the active UI language (so the backend
//    returns error messages in the same language).
//  - response: on a 401, try the refresh token once, then replay the request.
export function attachInterceptors(api) {
  api.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    config.headers['Accept-Language'] = i18n.language === 'ar' ? 'ar' : 'en';
    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config;
      const status = error.response?.status;

      if (status === 401 && original && !original._retried && getRefreshToken()) {
        original._retried = true;
        try {
          // plain axios (not `api`) so this refresh call skips the interceptors
          const { data } = await axios.post(
            `${api.defaults.baseURL}${API.auth.refresh}`,
            { refresh_token: getRefreshToken() },
          );
          setTokens(data);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          clearTokens();
        }
      }

      return Promise.reject(error);
    },
  );
}
