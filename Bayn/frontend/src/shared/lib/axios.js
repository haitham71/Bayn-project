import axios from 'axios';
import { attachInterceptors } from './interceptors';

// Base URL points at the FastAPI backend. Override with VITE_API_URL in a .env
// file when the API runs somewhere other than localhost:8000.
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL,
  // Fail after 15s instead of hanging forever when the backend is unreachable,
  // so the UI can surface an error rather than sitting on a loading state.
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

attachInterceptors(api);

export default api;
