import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from '../ui/ThemeToggle';
import useFavorites from '../../hooks/useFavorites';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { count } = useFavorites();

  const links = [
    { to: '/', label: 'Inicio' },
    { to: '/propiedades', label: 'Propiedades' },
    { to: '/nosotros', label: 'Sobre Nosotros' },
    { to: '/contacto', label: 'Contacto' },
    { to: '/trabaja-con-nosotros', label: 'Trabaja con nosotros' },
  ];

  return (
    <motion.nav
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="bg-blue-900 text-white sticky top-0 z-50 shadow-lg"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <motion.img
              src="/logo.png"
              alt="Triomphe Bienes Raíces"
              className="h-10 w-auto brightness-0 invert"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            />
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-8">
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
                    `text-sm font-medium transition-colors hover:text-yellow-400 ${isActive ? 'text-yellow-400' : 'text-gray-200'}`
                  }
                >
                  {label}
                </NavLink>
              </motion.div>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/favoritos"
              title="Mis favoritos"
              className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-blue-800 transition-colors"
            >
              <Heart size={18} className="text-gray-200" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {count > 9 ? '9+' : count}
                </span>
              )}
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
                className="text-sm font-medium bg-yellow-400 text-blue-900 px-4 py-1.5 rounded-lg hover:bg-yellow-300 transition-colors"
              >
                Acceso Admin
              </Link>
            </motion.div>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button className="p-2" onClick={() => setOpen(!open)}>
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
            className="md:hidden bg-blue-800 overflow-hidden"
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
                      `block py-2 text-sm font-medium border-b border-blue-700 ${isActive ? 'text-yellow-400' : 'text-gray-200'}`
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
                  className="block py-2 text-sm font-medium text-yellow-400 border-b border-blue-700"
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
