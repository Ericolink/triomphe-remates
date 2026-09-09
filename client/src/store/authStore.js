import { create } from 'zustand';
import { logoutRequest } from '../services/authService';

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),

  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  // Reemplaza solo el token (ej. tras un cambio de password/rol propio que invalida
  // el anterior vía tokenVersion) sin tocar los datos de usuario ya guardados.
  setToken: (token) => {
    localStorage.setItem('token', token);
    set({ token });
  },

  updateUser: (updatedFields) =>
    set((state) => {
      const user = { ...state.user, ...updatedFields };
      localStorage.setItem('user', JSON.stringify(user));
      return { user };
    }),

  // Revoca la sesión del lado servidor (ver server/src/services/sessionService.js) sin
  // bloquear el logout en la UI por ello — si la llamada falla (sin red, token ya vencido),
  // el comportamiento visible es idéntico al de antes: se limpia el estado local igual y el
  // token, en el peor caso, simplemente expira solo más tarde.
  logout: () => {
    logoutRequest().catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

export default useAuthStore;
