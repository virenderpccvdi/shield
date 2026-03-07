import api from './axios';

export const analyticsApi = {
  stats: (profileId: string, period?: string) => api.get(`/analytics/${profileId}/stats`, { params: { period } }),
  topDomains: (profileId: string, params?: any) => api.get(`/analytics/${profileId}/top-domains`, { params }),
  daily: (profileId: string, params?: any) => api.get(`/analytics/${profileId}/daily`, { params }),
  categories: (profileId: string) => api.get(`/analytics/${profileId}/categories`),
  history: (profileId: string, params?: any) => api.get(`/analytics/${profileId}/history`, { params }),
  report: (profileId: string) => `/api/v1/analytics/${profileId}/report/pdf`,
  platform: () => api.get('/analytics/platform/overview'),
  platformDaily: (params?: any) => api.get('/analytics/platform/daily', { params }),
  tenant: (tenantId: string) => api.get(`/analytics/tenant/${tenantId}/overview`),
};
