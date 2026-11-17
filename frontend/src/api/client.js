import axios from 'axios';

export const http = axios.create({ baseURL: '/api', timeout: 10000 });
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.startsWith('/auth/')) {
      window.dispatchEvent(new Event('cc-session-expired'));
    }
    return Promise.reject(error);
  },
);

http.interceptors.request.use(async (config) => {
  if (!['get', 'head', 'options'].includes(config.method || 'get')) {
    const { data } = await axios.get('/api/auth/csrf');
    config.headers['X-XSRF-TOKEN'] = data.token;
  }
  return config;
});

export function errorText(error) {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.code === 'ERR_NETWORK') return 'Нет соединения с backend. Запустите Spring Boot на порту 8080.';
  return 'Не удалось выполнить действие. Попробуйте ещё раз.';
}

const formFile = (file) => {
  const form = new FormData();
  form.append('file', file);
  return form;
};
export const api = {
  unpublish: (id, reason) => http.post('/admin/recipes/' + id + '/unpublish', { reason }).then((r) => r.data),
  mediaCleanup: (data) => http.post('/admin/media/cleanup', data).then((r) => r.data),
  requestVerification: (data) => http.post('/auth/verification/request', data).then((r) => r.data),
  verifyEmail: (data) => http.post('/auth/verification/confirm', data),
  requestPassword: (data) => http.post('/auth/password/request', data).then((r) => r.data),
  resetPassword: (data) => http.post('/auth/password/reset', data),
  report: (id, data) => http.post('/recipes/' + id + '/reports', data).then((r) => r.data),
  myReports: (params) => http.get('/reports', { params }).then((r) => r.data),
  adminReports: (params) => http.get('/admin/reports', { params }).then((r) => r.data),
  reportDecision: (id, data) => http.post('/admin/reports/' + id + '/decision', data).then((r) => r.data),
  adminUsers: (params) => http.get('/admin/users', { params }).then((r) => r.data),
  blockUser: (id, data) => http.post('/admin/users/' + id + '/block', data).then((r) => r.data),
  unblockUser: (id) => http.post('/admin/users/' + id + '/unblock').then((r) => r.data),
  adminAudit: (params) => http.get('/admin/audit', { params }).then((r) => r.data),
  avatar: (file) => http.post('/account/avatar', formFile(file)).then((r) => r.data),
  deleteAvatar: () => http.delete('/account/avatar'),
  photo: (id, file) => http.post('/recipes/' + id + '/photo', formFile(file)).then((r) => r.data),
  deletePhoto: (id) => http.delete('/recipes/' + id + '/photo'),
  profileName: (data) => http.put('/account/profile', data).then((r) => r.data),
  profileEmail: (data) => http.put('/account/email', data).then((r) => r.data),
  profilePassword: (data) => http.put('/account/password', data),
  me: () => http.get('/auth/me').then((r) => r.data),
  login: (data) => http.post('/auth/login', data).then((r) => r.data),
  register: (data) => http.post('/auth/register', data).then((r) => r.data),
  logout: () => http.post('/auth/logout'),
  users: () => http.get('/users/demo').then((r) => r.data),
  catalog: (params) => http.get('/recipes', { params }).then((r) => r.data),
  one: (id) => http.get(`/recipes/${id}`).then((r) => r.data),
  mine: () => http.get('/recipes/mine').then((r) => r.data),
  favorites: () => http.get('/recipes/favorites').then((r) => r.data),
  pending: () => http.get('/recipes/pending').then((r) => r.data),
  create: (data) => http.post('/recipes', data).then((r) => r.data),
  update: (id, data) => http.put(`/recipes/${id}`, data).then((r) => r.data),
  remove: (id) => http.delete(`/recipes/${id}`),
  toggleFavorite: (id) => http.post(`/recipes/${id}/favorite`).then((r) => r.data),
  reviews: (id) => http.get(`/recipes/${id}/reviews`).then((r) => r.data),
  addReview: (id, data) => http.post(`/recipes/${id}/reviews`, data).then((r) => r.data),
  moderate: (id, status) => http.post(`/recipes/${id}/moderate`, { status }).then((r) => r.data),
};
