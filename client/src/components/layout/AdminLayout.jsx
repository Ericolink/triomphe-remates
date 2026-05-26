import { useState } from 'react';
import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, LogOut, Menu, ChevronRight } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import NotificationBell from '../ui/NotificationBell';
import ThemeToggle from '../ui/ThemeToggle';
import toast from 'react-hot-toast';

const links = [
  { to: '/admin/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { to: '/admin/propiedades', icon: <Building2 size={18} />, label: 'Propiedades' },
  { to: '/admin/leads', icon: <Users size={18} />, label: 'Leads' },
];

function Sidebar({ user, onClose, onLogout }) {
  return (
    <div className="flex flex-col h-full bg-blue-900 text-white w-64">
      <div className="p-6 border-b border-blue-800">
        <img src="/logo.png" alt="Triomphe" className="h-8 w-auto brightness-0 invert" />
        <p className="text-blue-300 text-xs mt-2">{user?.name}</p>
        <span className="inline-block mt-1 text-xs bg-yellow-400 text-blue-900 px-2 py-0.5 rounded-full font-semibold capitalize">
          {user?.role}
        </span>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-yellow-400 text-blue-900' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
              }`
            }>
            {icon} {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-blue-800">
        <button onClick={onLogout}
          className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-sm font-medium text-blue-200 hover:bg-blue-800 hover:text-white transition-colors">
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
    <div className="flex h-screen bg-gray-100 dark:bg-[#1a1f2e] overflow-hidden">
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar user={user} onClose={() => {}} onLogout={handleLogout} />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="flex-shrink-0">
            <Sidebar user={user} onClose={() => setOpen(false)} onLogout={handleLogout} />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-[#242938] border-b border-gray-200 dark:border-[#2e3650] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1 text-gray-600 dark:text-gray-300" onClick={() => setOpen(true)}>
              <Menu size={22} />
            </button>
            <div className="hidden md:flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
              <span>Admin</span>
              <ChevronRight size={14} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle className="hover:bg-gray-100 dark:hover:bg-[#2e3650] text-gray-600 dark:text-gray-300" />
            <NotificationBell />
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <div className="w-8 h-8 bg-blue-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span className="hidden md:block font-medium">{user?.name}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
