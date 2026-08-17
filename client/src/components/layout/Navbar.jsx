import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Heart, GitCompare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from '../ui/ThemeToggle';
import useFavorites from '../../hooks/useFavorites';
import useComparator from '../../hooks/useComparator';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { count } = useFavorites();
  const { count: compareCount } = useComparator();

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
      <div className="max-w-[1920px] mx-auto px-6 sm:px-8 lg:px-12 xl:px-16">
        {/* grid en vez de flex+justify-between: así el menú queda centrado en el
            espacio disponible entre logo y acciones sin importar que ambos extremos
            tengan anchos distintos (justify-between solo reparte el hueco sobrante,
            no centra el contenido intermedio de verdad). */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 h-20 dk:h-28">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <motion.img
              src="/logo.png"
              alt="Triomphe Bienes Raíces"
              className="h-14 dk:h-20 w-auto brightness-0 invert"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            />
          </Link>

          {/* Desktop — columna central, se centra dentro del espacio libre entre
              logo y acciones. minmax(0,1fr) arriba + min-w-0 aquí evitan que el
              ancho mínimo de los links (whitespace-nowrap) fuerce el desborde del
              grid o aplaste la columna del logo — gotcha clásico de CSS Grid.
              "dk" (1800px, ver tailwind.config.js) en vez de "lg": con el font-size
              global del sitio, 6 links sin salto de línea no caben cómodos antes de
              eso — por debajo se usa el menú hamburguesa. */}
          <div className="hidden dk:flex items-center justify-center gap-10 dk:gap-12 min-w-0">
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
                    `text-base font-bold whitespace-nowrap transition-colors hover:text-accent-400 ${isActive ? 'text-accent-400' : 'text-gray-200'}`
                  }
                >
                  {label}
                </NavLink>
              </motion.div>
            ))}
          </div>

          {/* col-start-3 explícito: si el menú central no se renderiza (mobile,
              hidden), evita que este bloque caiga en la columna 1fr del centro */}
          <div className="col-start-3 flex items-center gap-2">
            <div className="hidden dk:flex items-center gap-2">
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
                <span className="text-base font-bold text-gray-200">Favoritos</span>
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
                <span className="text-base font-bold text-gray-200">Comparar</span>
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

            <div className="flex items-center gap-2 dk:hidden">
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
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="dk:hidden bg-primary-800 overflow-hidden"
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
