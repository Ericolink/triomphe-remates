import { Sun, Moon } from 'lucide-react';
import useThemeStore from '../../store/themeStore';

export default function ThemeToggle({ className = '' }) {
  const isDark = useThemeStore((state) => state.theme === 'dark');
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  return (
    <button
      onClick={toggleTheme}
      className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${className}`}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      aria-label="Cambiar tema"
    >
      {isDark ? (
        <Sun size={18} className="text-accent-400" />
      ) : (
        <Moon size={18} className="text-gray-800" />
      )}
    </button>
  );
}
