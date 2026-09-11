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
      // Escala tipográfica base más legible (auditoría de accesibilidad 2026-09-10).
      // Cada paso queda envuelto en calc(... * var(--app-text-scale, 1)) para que el
      // selector de "Tamaño del texto" (ver textSizeStore.js) pueda escalar TODO el
      // texto de la app con un solo custom property en :root, sin tocar el font-size
      // del <html> — a diferencia del intento de julio/agosto 2026 (ver git history de
      // este archivo), que sí tocaba `html { font-size }` y por lo tanto también
      // inflaba cualquier medida en rem (paddings, anchos, gaps), rompiendo el Navbar
      // y obligando al breakpoint `dk: 1800px` de emergencia. Aquí SOLO el tamaño de
      // fuente y su line-height responden a la variable; el spacing/layout no se toca,
      // así que el único efecto de agrandar el texto es que el contenido reacomoda su
      // alto naturalmente (line-wrap, tarjetas/tablas más altas) — nunca un overflow
      // de ancho. `var(--app-text-scale, 1)` cae a 1 automáticamente en cualquier árbol
      // que no herede el atributo `data-text-size` de <html> (ver FichaTecnica.jsx, que
      // fija la variable a 1 explícitamente para que el PNG exportado no varíe según la
      // preferencia de accesibilidad de quien esté usando el panel admin).
      fontSize: {
        xs: ['calc(0.8125rem * var(--app-text-scale, 1))', { lineHeight: 'calc(1.25rem * var(--app-text-scale, 1))' }],
        sm: ['calc(0.9375rem * var(--app-text-scale, 1))', { lineHeight: 'calc(1.5rem * var(--app-text-scale, 1))' }],
        base: ['calc(1.0625rem * var(--app-text-scale, 1))', { lineHeight: 'calc(1.75rem * var(--app-text-scale, 1))' }],
        lg: ['calc(1.1875rem * var(--app-text-scale, 1))', { lineHeight: 'calc(1.85rem * var(--app-text-scale, 1))' }],
        xl: ['calc(1.3125rem * var(--app-text-scale, 1))', { lineHeight: 'calc(1.9rem * var(--app-text-scale, 1))' }],
        '2xl': ['calc(1.625rem * var(--app-text-scale, 1))', { lineHeight: 'calc(2.1rem * var(--app-text-scale, 1))' }],
        '3xl': ['calc(2rem * var(--app-text-scale, 1))', { lineHeight: 'calc(2.4rem * var(--app-text-scale, 1))' }],
        '4xl': ['calc(2.375rem * var(--app-text-scale, 1))', { lineHeight: 'calc(2.7rem * var(--app-text-scale, 1))' }],
        '5xl': ['calc(3.125rem * var(--app-text-scale, 1))', { lineHeight: '1.15' }],
        '6xl': ['calc(3.875rem * var(--app-text-scale, 1))', { lineHeight: '1.1' }],
      },
      spacing: {
        4.5: '1.125rem',
        5.5: '1.375rem',
      },
      screens: {
        // El Navbar necesita más ancho que el "lg" estándar (1024px) para mostrar el
        // menú de 6 links distribuido sin salto de línea ni desborde. Este valor se
        // fijó en 1800px cuando el font-size global del sitio era 18px (ver auditoría
        // móvil 2026-08-17); ahora que la escala tipográfica volvió a la base estándar
        // de Tailwind, este breakpoint casi seguro puede bajar — queda pendiente de
        // revisión en la fase de responsive (no se toca en esta corrección quirúrgica
        // de tipografía). Por debajo de "dk" se usa el menú hamburguesa. Ver Navbar.jsx.
        dk: '1800px',
      },
    },
  },
  plugins: [],
};
