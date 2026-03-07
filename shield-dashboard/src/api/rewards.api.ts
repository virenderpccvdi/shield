import api from './axios';

export const rewardsApi = {
  tasks: (profileId: string) => api.get(`/rewards/tasks/${profileId}`),
  createTask: (data: any) => api.post('/rewards/tasks', data),
  approveTask: (taskId: string) => api.post(`/rewards/tasks/${taskId}/approve`),
  rejectTask: (taskId: string) => api.post(`/rewards/tasks/${taskId}/reject`),
  completeTask: (taskId: string, profileId: string) => api.post(`/rewards/tasks/${taskId}/complete?profileId=${profileId}`),
  bank: (profileId: string) => api.get(`/rewards/bank/${profileId}`),
  redeem: (profileId: string, data: any) => api.post(`/rewards/bank/${profileId}/redeem`, data),
  achievements: (profileId: string) => api.get(`/rewards/achievements/${profileId}`),
  streaks: (profileId: string) => api.get(`/rewards/${profileId}/streaks`),
  bonus: (profileId: string, data: any) => api.post(`/rewards/${profileId}/bonus`, data),
};
