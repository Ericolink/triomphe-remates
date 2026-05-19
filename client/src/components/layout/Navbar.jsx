import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const links = [
    { to: '/', label: 'Inicio' },
    { to: '/propiedades', label: 'Propiedades' },
    { to: '/nosotros', label: 'Sobre Nosotros' },
    { to: '/contacto', label: 'Contacto' },
  ];

  return (
    <nav className="bg-blue-900 text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Triomphe Bienes Raíces"
              className="h-14 w-auto brightness-0 invert"
            />

            <span className="text-xl font-bold text-white">
              Triomphe <span className="text-yellow-400">Bienes Raíces</span>
            </span>
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-8">
            {links.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors hover:text-yellow-400 ${isActive ? 'text-yellow-400' : 'text-gray-200'}`
                }>
                {label}
              </NavLink>
            ))}
            <Link to="/admin/login"
              className="text-sm font-medium bg-yellow-400 text-blue-900 px-4 py-1.5 rounded-lg hover:bg-yellow-300 transition-colors">
              Acceso Admin
            </Link>
          </div>

          <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-blue-800 px-4 pb-4 flex flex-col gap-3">
          {links.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `py-2 text-sm font-medium border-b border-blue-700 ${isActive ? 'text-yellow-400' : 'text-gray-200'}`
              }>
              {label}
            </NavLink>
          ))}
          <Link to="/admin/login" onClick={() => setOpen(false)}
            className="py-2 text-sm font-medium text-yellow-400 border-b border-blue-700">
            Acceso Admin
          </Link>
        </div>
      )}
    </nav>
  );
}
