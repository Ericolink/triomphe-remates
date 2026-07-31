import { Sun, Moon } from 'lucide-react';
import useThemeStore from '../../store/themeStore';

export default function ThemeToggle({ className = '', sunClassName = 'text-accent-400', moonClassName = 'text-gray-800' }) {
  const isDark = useThemeStore((state) => state.theme === 'dark');
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  return (
    <button
      onClick={toggleTheme}
      className={`w-11 h-11 flex items-center justify-center rounded-xl transition-colors ${className}`}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      aria-label="Cambiar tema"
    >
      {isDark ? (
        <Sun size={22} className={sunClassName} />
      ) : (
        <Moon size={22} className={moonClassName} />
      )}
    </button>
  );
}
