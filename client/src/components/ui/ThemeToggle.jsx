import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ className = '' }) {
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const next = !isDark;
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  return (
    <button onClick={toggle}
      className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${className}`}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      aria-label="Cambiar tema">
      {isDark ? (
        <Sun size={18} className="text-yellow-400" />
      ) : (
        <Moon size={18} className="text-gray-800" />
      )}
    </button>
  );
}
