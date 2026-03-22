import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const correlationId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const state = useAuthStore.getState();
  if (state.accessToken) config.headers.Authorization = `Bearer ${state.accessToken}`;
  if ((state.user?.role === 'ISP_ADMIN' || state.user?.role === 'CUSTOMER') && state.user?.tenantId) {
    config.headers['X-Tenant-Id'] = state.user.tenantId;
  }
  config.headers['X-Correlation-ID'] = correlationId;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/app/login';
    }
    return Promise.reject(error);
  }
);

export default api;
