import axios from 'axios';

export const http = axios.create({ baseURL: '/api', timeout: 10000 });

http.interceptors.request.use((config) => {
  const userId = localStorage.getItem('cc-demo-user');
  if (userId && userId !== 'guest') config.headers['X-Demo-User'] = userId;
  return config;
});

export function errorText(error) {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.code === 'ERR_NETWORK') return 'Нет соединения с backend. Запустите Spring Boot на порту 8080.';
  return 'Не удалось выполнить действие. Попробуйте ещё раз.';
}

export const api = {
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
