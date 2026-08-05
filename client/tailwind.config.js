export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta corporativa Triomphe — navy institucional, base = #22273A
        primary: {
          50: '#EEF0F4',
          100: '#D7DAE4',
          200: '#B4BBCC',
          300: '#8890AC',
          400: '#5C6690',
          500: '#454F68',
          600: '#343C56',
          700: '#2B3145',
          800: '#262B3F',
          900: '#22273A',
          950: '#14161F',
        },
        // Dorado corporativo — base = #D2A057, en el escalón 400 (reemplaza yellow-400 como CTA)
        accent: {
          50: '#FBF3E7',
          100: '#F5E4C9',
          300: '#E4C48D',
          400: '#D2A057',
          500: '#C08D3E',
          600: '#A5762E',
          900: '#4A3419',
        },
        // Rojo institucional — uso puntual (no reemplaza el rojo funcional de error/destructivo)
        'brand-red': {
          50: '#F8E8E7',
          100: '#F0D1CF',
          400: '#C05650',
          600: '#A22C27',
          700: '#872420',
        },
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
      screens: {
        // El Navbar necesita bastante más ancho que el "lg" estándar (1024px) para
        // mostrar el menú de 6 links totalmente distribuido sin salto de línea ni
        // desborde — con el font-size global del sitio (18px) no cabe cómodamente
        // hasta ~1700px. Por debajo de "dk" se usa el menú hamburguesa. Ver Navbar.jsx.
        dk: '1800px',
      },
    },
  },
  plugins: [],
};
