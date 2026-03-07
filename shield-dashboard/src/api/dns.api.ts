import api from './axios';

export const dnsApi = {
  rules: (profileId: string) => api.get(`/dns/rules/${profileId}`),
  updateCategories: (profileId: string, data: any) => api.put(`/dns/rules/${profileId}/categories`, data),
  updateAllowlist: (profileId: string, data: any) => api.put(`/dns/rules/${profileId}/allowlist`, data),
  updateBlocklist: (profileId: string, data: any) => api.put(`/dns/rules/${profileId}/blocklist`, data),
  domainAction: (profileId: string, data: any) => api.post(`/dns/rules/${profileId}/domain/action`, data),
  activity: (profileId: string) => api.get(`/dns/rules/${profileId}/activity`),
  pause: (profileId: string) => api.post(`/dns/rules/${profileId}/pause`),
  resume: (profileId: string) => api.post(`/dns/rules/${profileId}/resume`),
  categories: () => api.get('/dns/categories'),
  schedule: (profileId: string) => api.get(`/dns/schedules/${profileId}`),
  updateSchedule: (profileId: string, data: any) => api.put(`/dns/schedules/${profileId}`, data),
  budget: (profileId: string) => api.get(`/dns/budgets/${profileId}`),
  budgetToday: (profileId: string) => api.get(`/dns/budgets/${profileId}/today`),
  updateBudget: (profileId: string, data: any) => api.put(`/dns/budgets/${profileId}`, data),
  extendBudget: (profileId: string, data: any) => api.post(`/dns/budgets/${profileId}/extend`, data),
};
