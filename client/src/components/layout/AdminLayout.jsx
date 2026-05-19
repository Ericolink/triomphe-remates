import { useState } from 'react';
import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, LogOut,
  Menu, ChevronRight
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const links = [
  { to: '/admin/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { to: '/admin/propiedades', icon: <Building2 size={18} />, label: 'Propiedades' },
  { to: '/admin/leads', icon: <Users size={18} />, label: 'Clientes' },
];

function Sidebar({ mobile = false, user, onClose, onLogout }) {
  return (
    <div className="flex flex-col h-full bg-blue-900 text-white w-64">
      <div className="p-6 border-b border-blue-800">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Triomphe Bienes Raíces"
            className="h-12 w-auto brightness-0 invert"
          />

          <div className="flex flex-col leading-tight">
            <span className="font-bold text-lg text-white">
              Triomphe
            </span>

            <span className="text-sm font-semibold text-yellow-400">
              Admin
            </span>
          </div>
        </div>

        <p className="text-blue-300 text-xs mt-3">
          {user?.name}
        </p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => mobile && onClose()}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-yellow-400 text-blue-900'
                  : 'text-blue-200 hover:bg-blue-800 hover:text-white'
              }`
            }
          >
            {icon} {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-blue-800">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-sm font-medium text-blue-200 hover:bg-blue-800 hover:text-white transition-colors"
        >
          <LogOut size={18} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;

  const handleLogout = () => {
    logout();
    toast.success('Sesión cerrada');
    navigate('/admin/login');
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar desktop */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar user={user} onClose={() => setOpen(false)} onLogout={handleLogout} />
      </div>

      {/* Sidebar mobile */}
      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="flex-shrink-0">
            <Sidebar mobile user={user} onClose={() => setOpen(false)} onLogout={handleLogout} />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <button className="md:hidden p-1" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="hidden md:flex items-center gap-1 text-sm text-gray-500">
            <span>Admin</span>
            <ChevronRight size={14} />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-8 h-8 bg-blue-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <span className="hidden md:block">{user?.name}</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}