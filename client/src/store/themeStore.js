import { create } from 'zustand';

// main.jsx applies the persisted/preferred theme to <html> synchronously
// before React mounts (to avoid a flash of the wrong theme), so this reads
// that already-correct DOM state as the initial value instead of guessing.
const getInitialTheme = () =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

const useThemeStore = create((set) => ({
  theme: getInitialTheme(),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark', next === 'dark');
      localStorage.setItem('theme', next);
      return { theme: next };
    }),
}));

export default useThemeStore;
