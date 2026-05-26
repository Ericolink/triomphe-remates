import { create } from 'zustand';

const useThemeStore = create((set) => ({
  theme: 'light',
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('theme', next);
        if (next === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch {}
      return { theme: next };
    }),
  initTheme: (theme) => set({ theme }),
}));

export default useThemeStore;
