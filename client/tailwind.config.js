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
        dark: {
          bg: '#1a1f2e',
          surface: '#242938',
          border: '#2e3650',
          muted: '#374060',
        },
      },
      fontSize: {
        xs: ['0.95rem', { lineHeight: '1.45rem' }],
        sm: ['1.05rem', { lineHeight: '1.65rem' }],
        base: ['1.2rem', { lineHeight: '1.85rem' }],
        lg: ['1.35rem', { lineHeight: '2rem' }],
        xl: ['1.5rem', { lineHeight: '2.1rem' }],
        '2xl': ['1.85rem', { lineHeight: '2.3rem' }],
        '3xl': ['2.35rem', { lineHeight: '2.7rem' }],
        '4xl': ['2.85rem', { lineHeight: '3.2rem' }],
        '5xl': ['3.6rem', { lineHeight: '1.05' }],
        '6xl': ['4.4rem', { lineHeight: '1' }],
      },
      spacing: {
        4.5: '1.125rem',
        5.5: '1.375rem',
      },
    },
  },
  plugins: [],
};
