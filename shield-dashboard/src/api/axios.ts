import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const correlationId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1',
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

// ── Token refresh queue ───────────────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

const drainQueue = (token: string | null, error: unknown = null) => {
  failedQueue.forEach(p => (token ? p.resolve(token) : p.reject(error)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    // Only attempt refresh on 401, and only once per request
    if (error.response?.status === 401 && !originalRequest._retry) {
      const authState = useAuthStore.getState();
      const refreshToken = authState.refreshToken;

      // No refresh token available — log out immediately
      if (!refreshToken) {
        authState.logout();
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return Promise.reject(error);
      }

      // If a refresh is already in progress, queue this request
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Use a plain axios call (not `api`) to avoid triggering this interceptor again
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/v1` : '/api/v1'}/auth/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' } },
        );
        const newAccessToken: string =
          response.data?.data?.accessToken ??
          response.data?.accessToken ??
          response.data?.token;
        const newRefreshToken: string | undefined =
          response.data?.data?.refreshToken ?? response.data?.refreshToken;

        // Persist new tokens via the store's setAuth (preserves user object)
        const currentState = useAuthStore.getState();
        currentState.setAuth(currentState.user!, newAccessToken, newRefreshToken ?? refreshToken);

        drainQueue(newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        drainQueue(null, refreshError);
        useAuthStore.getState().logout();
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
