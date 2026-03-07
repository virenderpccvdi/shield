import api from './axios';

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
  changePassword: (data: any) => api.post('/auth/change-password', data),
  mfaSetup: () => api.post('/auth/mfa/setup'),
  mfaVerify: (code: string) => api.post('/auth/mfa/verify', { code }),
  mfaValidate: (mfaToken: string, code: string) => api.post('/auth/mfa/validate', { mfaToken, code }),
  users: (params?: any) => api.get('/auth/users', { params }),
  adminRegister: (data: any) => api.post('/auth/admin/register', data),
  updateUser: (id: string, data: any) => api.put(`/auth/admin/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/auth/admin/users/${id}`),
};
