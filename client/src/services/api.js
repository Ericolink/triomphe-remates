import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// `skipAuth: true` en la config de una llamada evita adjuntar el JWT — necesario para
// formularios públicos que comparten endpoint con el panel admin (ej. POST /leads, usado
// tanto por el "Contactar asesor" público como por "Nuevo prospecto" del CRM): sin esto,
// un visitante con una pestaña de /admin abierta en el mismo navegador manda sin querer el
// token de ESA sesión (localStorage es por origen, no por pestaña) en un envío que debería
// ser anónimo — ver createPublicLead en leadService.js para el caso real que lo motivó.
api.interceptors.request.use((config) => {
  if (!config.skipAuth) {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 401 con uno de estos `code` NO significa "sesión inválida" — es un rechazo de negocio
// del propio endpoint que reutiliza el statusCode 401 (ej. PUT /auth/change-password y
// PUT /users/:id devuelven 401 para "contraseña actual incorrecta", ver authController.js
// y usersController.js). authMiddleware siempre responde 401 con code 'INVALID_SESSION'
// para token ausente/inválido/expirado o tokenVersion desincronizado — ese es el único
// caso que debe cerrar sesión. Este es el único punto del frontend que decide "cerrar
// sesión sí/no" ante un 401; los componentes no deben duplicar esta lógica ni comparar
// el texto de `error` para tomar esa decisión (ver ChangePasswordModal.jsx).
const NON_SESSION_401_CODES = new Set(['INVALID_CURRENT_PASSWORD']);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    if (status === 401 && !NON_SESSION_401_CODES.has(code)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default api;
