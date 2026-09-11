import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Heart, GitCompare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from '../ui/ThemeToggle';
import TextSizeControl from '../ui/TextSizeControl';
import useFavorites from '../../hooks/useFavorites';
import useComparator from '../../hooks/useComparator';
import useTextSizeStore, { TEXT_SIZES, TEXT_SIZE_LABELS } from '../../store/textSizeStore';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { count } = useFavorites();
  const { count: compareCount } = useComparator();
  const textSize = useTextSizeStore((state) => state.textSize);
  const setTextSize = useTextSizeStore((state) => state.setTextSize);

  const links = [
    { to: '/', label: 'Inicio' },
    { to: '/propiedades', label: 'Propiedades' },
    { to: '/nosotros', label: 'Sobre Nosotros' },
    { to: '/proceso-adquisicion', label: 'Proceso de Adquisición' },
    { to: '/contacto', label: 'Contacto' },
    { to: '/trabaja-con-nosotros', label: 'Trabaja con nosotros' },
  ];

  return (
    <motion.nav
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="bg-primary-900 text-white sticky top-0 z-50 shadow-lg"
    >
      <div className="max-w-[1920px] mx-auto px-6 sm:px-8 dk:px-16">
        {/* Fila de escritorio — visible siempre desde "lg" (1024px, ver comentario en
            nav-mobile-row más abajo sobre por qué ese piso es constante). flex-wrap (no
            CSS Grid de 3 columnas) a propósito: con Grid, las columnas externas (logo,
            acciones) crecían con el texto sin límite y exprimían la columna central del
            menú hasta solaparla — el bug que motivó este rediseño (ver git history de
            este archivo, auditoría 2026-09-10/11). Con flexbox, .nav-links usa
            flex-basis:0/flex-grow:1 para ocupar el espacio libre entre logo y acciones
            (equivalente al viejo grid-cols minmax(0,1fr), pero sin la mecánica de
            "exprimir columnas") CUANDO cabe en una sola línea, y flex-basis:100% para
            forzar su propia línea completa cuando no cabe — ver `.nav-links` en
            index.css: el punto exacto donde cambia de un modo a otro depende del
            tamaño de texto activo (Normal/Grande/Muy grande tienen distinto ancho de
            contenido) y se determinó midiendo, no adivinando. min-h en vez de h fija:
            si el menú va en su propia línea, el header debe poder crecer de alto en
            vez de recortar contenido. */}
        <div className="hidden lg:flex flex-wrap items-center justify-between gap-x-4 gap-y-2 min-h-20 dk:min-h-28 py-3">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <motion.img
              src="/logo.png"
              alt="Triomphe Bienes Raíces"
              className="h-14 dk:h-20 w-auto brightness-0 invert"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            />
          </Link>

          <div className="nav-links flex flex-wrap items-center justify-center gap-x-4 gap-y-1 dk:gap-x-12 min-w-0">
            {links.map(({ to, label }, i) => (
              <motion.div
                key={to}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.07 }}
              >
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `text-base dk:text-lg font-bold whitespace-nowrap transition-colors hover:text-accent-400 ${isActive ? 'text-accent-400' : 'text-gray-200'}`
                  }
                >
                  {label}
                </NavLink>
              </motion.div>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle className="hover:bg-primary-800" moonClassName="text-gray-200" />
            <TextSizeControl className="hover:bg-primary-800" iconClassName="text-gray-200" />
            <Link
              to="/favoritos"
              title="Mis favoritos"
              className="flex items-center gap-1.5 h-11 px-2 rounded-lg hover:bg-primary-800 transition-colors"
            >
              <span className="relative flex items-center justify-center w-[22px] h-[22px]">
                <Heart size={22} className="text-gray-200" />
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-5 h-5 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </span>
              <span className="hidden dk:inline text-base font-bold text-gray-200">
                Favoritos
              </span>
            </Link>
            <Link
              to="/comparar"
              title="Comparar propiedades"
              className="flex items-center gap-1.5 h-11 px-2 rounded-lg hover:bg-primary-800 transition-colors"
            >
              <span className="relative flex items-center justify-center w-[22px] h-[22px]">
                <GitCompare size={22} className="text-gray-200" />
                {compareCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-5 h-5 px-1 bg-accent-400 text-primary-900 text-xs rounded-full flex items-center justify-center font-bold">
                    {compareCount}
                  </span>
                )}
              </span>
              <span className="hidden dk:inline text-base font-bold text-gray-200">
                Comparar
              </span>
            </Link>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
            >
              <Link
                to="/admin/login"
                className="text-base font-bold bg-accent-400 text-primary-900 px-4 py-1.5 rounded-lg hover:bg-accent-300 transition-colors whitespace-nowrap"
              >
                Acceso Admin
              </Link>
            </motion.div>
          </div>
        </div>

        {/* Fila móvil — visible por debajo de "lg" (1024px) SIEMPRE, sin importar el
            tamaño de texto: a diferencia del menú central de arriba (cuyo contenido
            crece mucho con el texto), esta fila solo tiene logo + iconos + hamburguesa,
            un contenido que ya se midió estable incluso en Muy grande muy por debajo de
            1024px (ver auditoría 2026-09-11) — por eso este piso puede ser constante en
            vez de depender también del tamaño de texto. */}
        <div className="flex lg:hidden items-center justify-between gap-2 h-20">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <motion.img
              src="/logo.png"
              alt="Triomphe Bienes Raíces"
              className="h-14 w-auto brightness-0 invert"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            />
          </Link>
          <div className="flex items-center gap-2">
              <ThemeToggle className="hover:bg-primary-800" moonClassName="text-gray-200" />
              <Link
                to="/favoritos"
                title="Mis favoritos"
                className="flex items-center gap-1.5 h-11 px-2 rounded-lg hover:bg-primary-800 transition-colors"
              >
                <span className="relative flex items-center justify-center w-[22px] h-[22px]">
                  <Heart size={22} className="text-gray-200" />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-5 h-5 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {count > 9 ? '9+' : count}
                    </span>
                  )}
                </span>
                <span className="hidden sm:inline text-base font-bold text-gray-200">
                  Favoritos
                </span>
              </Link>
              <Link
                to="/comparar"
                title="Comparar propiedades"
                className="flex items-center gap-1.5 h-11 px-2 rounded-lg hover:bg-primary-800 transition-colors"
              >
                <span className="relative flex items-center justify-center w-[22px] h-[22px]">
                  <GitCompare size={22} className="text-gray-200" />
                  {compareCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-5 h-5 px-1 bg-accent-400 text-primary-900 text-xs rounded-full flex items-center justify-center font-bold">
                      {compareCount}
                    </span>
                  )}
                </span>
                <span className="hidden sm:inline text-base font-bold text-gray-200">
                  Comparar
                </span>
              </Link>
              <button
                className="p-2"
                onClick={() => setOpen(!open)}
                aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
                aria-expanded={open}
              >
                <AnimatePresence mode="wait">
                  {open ? (
                    <motion.div
                      key="close"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <X size={24} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="menu"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Menu size={24} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="lg:hidden bg-primary-800 overflow-hidden"
          >
            <div className="px-4 pb-4 flex flex-col gap-3">
              {links.map(({ to, label }, i) => (
                <motion.div
                  key={to}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <NavLink
                    to={to}
                    end={to === '/'}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `block py-2 text-base font-bold border-b border-primary-700 ${isActive ? 'text-accent-400' : 'text-gray-200'}`
                    }
                  >
                    {label}
                  </NavLink>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                className="pt-1 pb-2 border-b border-primary-700"
              >
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Tamaño del texto
                </p>
                <div className="flex items-center gap-2" role="radiogroup" aria-label="Tamaño del texto">
                  {TEXT_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      role="radio"
                      aria-checked={textSize === size}
                      onClick={() => setTextSize(size)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        textSize === size
                          ? 'bg-accent-400 text-primary-900'
                          : 'bg-primary-800 text-gray-200 hover:bg-primary-700'
                      }`}
                    >
                      {TEXT_SIZE_LABELS[size]}
                    </button>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Link
                  to="/admin/login"
                  onClick={() => setOpen(false)}
                  className="block py-2 text-base font-bold text-accent-400 border-b border-primary-700"
                >
                  Acceso Admin
                </Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
