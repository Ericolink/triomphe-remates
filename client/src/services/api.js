import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // `skipAuthRedirect` lo pasan llamadas donde un 401 no significa "sesión expirada"
    // sino un rechazo de negocio propio del endpoint (ej. PUT /auth/change-password
    // responde 401 para "contraseña actual incorrecta", no para token inválido) — sin
    // este escape hatch, este handler global cerraría la sesión antes de que el
    // componente pudiera mostrar el error inline.
    if (error.response?.status === 401 && !error.config?.skipAuthRedirect) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default api;
