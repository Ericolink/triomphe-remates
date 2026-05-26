export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#1a3a5c',
        'primary-light': '#2d5986',
        accent: '#c8a96e',
        'accent-light': '#e8c98e',
        // Paleta dark más suave — no negro puro
        dark: {
          bg: '#1a1f2e',        // fondo principal
          surface: '#242938',   // cards y paneles
          border: '#2e3650',    // bordes
          muted: '#374060',     // elementos secundarios
        },
      },
    },
  },
  plugins: [],
};
