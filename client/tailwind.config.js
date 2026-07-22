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
        xs: ['0.875rem', { lineHeight: '1.3rem' }],
        sm: ['0.95rem', { lineHeight: '1.5rem' }],
        base: ['1.05rem', { lineHeight: '1.6rem' }],
        lg: ['1.2rem', { lineHeight: '1.75rem' }],
        xl: ['1.35rem', { lineHeight: '1.85rem' }],
        '2xl': ['1.6rem', { lineHeight: '2rem' }],
        '3xl': ['2rem', { lineHeight: '2.4rem' }],
        '4xl': ['2.4rem', { lineHeight: '2.8rem' }],
        '5xl': ['3rem', { lineHeight: '1.1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      spacing: {
        4.5: '1.125rem',
        5.5: '1.375rem',
      },
    },
  },
  plugins: [],
};
