import api from './axios';

export const locationApi = {
  latest: (profileId: string) => api.get(`/location/${profileId}/latest`),
  history: (profileId: string, params?: any) => api.get(`/location/${profileId}/history`, { params }),
  speed: (profileId: string) => api.get(`/location/${profileId}/speed`),
  geofences: (profileId: string) => api.get(`/location/${profileId}/geofences`),
  createGeofence: (profileId: string, data: any) => api.post(`/location/${profileId}/geofences`, data),
  updateGeofence: (profileId: string, id: string, data: any) => api.put(`/location/${profileId}/geofences/${id}`, data),
  deleteGeofence: (profileId: string, id: string) => api.delete(`/location/${profileId}/geofences/${id}`),
  places: (profileId: string) => api.get(`/location/${profileId}/places`),
  createPlace: (profileId: string, data: any) => api.post(`/location/${profileId}/places`, data),
  updatePlace: (profileId: string, id: string, data: any) => api.put(`/location/${profileId}/places/${id}`, data),
  deletePlace: (profileId: string, id: string) => api.delete(`/location/${profileId}/places/${id}`),
  checkin: (data: any) => api.post('/location/child/checkin', data),
  panic: (data: any) => api.post('/location/child/panic', data),
};
