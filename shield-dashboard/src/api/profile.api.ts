import api from './axios';

export const profileApi = {
  children: () => api.get('/profiles/children'),
  childById: (id: string) => api.get(`/profiles/children/${id}`),
  createChild: (data: any) => api.post('/profiles/children', data),
  updateChild: (id: string, data: any) => api.put(`/profiles/children/${id}`, data),
  deleteChild: (id: string) => api.delete(`/profiles/children/${id}`),
  childStatus: (id: string) => api.get(`/profiles/children/${id}/status`),
  devices: (profileId: string) => api.get(`/profiles/devices/profile/${profileId}`),
  addDevice: (data: any) => api.post('/profiles/devices', data),
  deleteDevice: (id: string) => api.delete(`/profiles/devices/${id}`),
  deviceQr: (childId: string) => api.get(`/profiles/devices/qr/${childId}`),
  family: () => api.get('/profiles/family'),
  inviteFamily: (data: any) => api.post('/profiles/family/invite', data),
  acceptInvite: (token: string) => api.post(`/profiles/family/accept?token=${token}`),
  updateFamilyRole: (id: string, role: string) => api.put(`/profiles/family/${id}/role`, { role }),
  removeFamilyMember: (id: string) => api.delete(`/profiles/family/${id}`),
};
