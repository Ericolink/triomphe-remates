import { useState } from 'react';
import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Building2, Users, LogOut, Menu, Briefcase, UserCheck, ShieldCheck, MessageSquare, Bell, ClipboardList, CalendarDays, MessageSquareQuote, TrendingUp, Megaphone, PieChart, Trophy } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import NotificationBell from '../ui/NotificationBell';
import ThemeToggle from '../ui/ThemeToggle';
import { buildImageUrl } from '../../utils/images';
import toast from 'react-hot-toast';

// Agrupado por tema (en vez de una lista plana de 11 ítems) para que la ubicación de
// cada sección sea predecible sin tener que leer cada label — ver auditoría UX admin.
const navGroups = [
  {
    label: null,
    links: [
      { to: '/admin/dashboard',     icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
      { to: '/admin/estadisticas',  icon: <BarChart3 size={18} />,       label: 'Estadísticas' },
    ],
  },
  {
    label: 'Propiedades',
    links: [{ to: '/admin/propiedades', icon: <Building2 size={18} />, label: 'Propiedades' }],
  },
  {
    label: 'CRM Comercial',
    links: [
      { to: '/admin/dashboard-comercial', icon: <TrendingUp size={18} />,  label: 'Dashboard Comercial' },
      { to: '/admin/leads',      icon: <Users size={18} />,       label: 'Prospectos' },
      { to: '/admin/casos-exito', icon: <Trophy size={18} />,     label: 'Casos de éxito' },
      { to: '/admin/calendario', icon: <CalendarDays size={18} />, label: 'Calendario de citas' },
      { to: '/admin/campanas',  icon: <Megaphone size={18} />,   label: 'Campañas' },
      { to: '/admin/reportes',  icon: <PieChart size={18} />,    label: 'Reportes' },
      { to: '/admin/buzon',      icon: <MessageSquare size={18} />, label: 'Buzón de opiniones' },
      { to: '/admin/alertas',    icon: <Bell size={18} />,         label: 'Alertas de propiedad' },
    ],
  },
  {
    label: 'Reclutamiento',
    links: [
      { to: '/admin/vacantes',      icon: <Briefcase size={18} />, label: 'Vacantes' },
      { to: '/admin/postulaciones', icon: <UserCheck size={18} />, label: 'Postulaciones' },
    ],
  },
  {
    label: 'Contenido',
    links: [{ to: '/admin/testimonios', icon: <MessageSquareQuote size={18} />, label: 'Testimonios' }],
  },
];

const adminOnlyGroup = {
  label: 'Sistema',
  links: [
    { to: '/admin/usuarios',  icon: <ShieldCheck size={18} />,   label: 'Usuarios' },
    { to: '/admin/auditoria', icon: <ClipboardList size={18} />, label: 'Auditoría' },
  ],
};

function Sidebar({ user, onClose, onLogout }) {
  const groups = [...navGroups, ...(user?.role === 'admin' ? [adminOnlyGroup] : [])];
  return (
    <div className="flex flex-col h-full bg-blue-900 text-white w-64">
      <div className="p-6 border-b border-blue-800">
        <a href="/" target="_blank" rel="noopener noreferrer" title="Ver sitio público">
          <img src="/logo.png" alt="Triomphe" className="h-25 w-auto brightness-0 invert hover:opacity-80 transition-opacity" />
        </a>
      </div>

      <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="px-4 mb-1 text-[11px] font-semibold uppercase tracking-wider text-blue-300/70">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.links.map(({ to, icon, label }) => (
                <NavLink key={to} to={to} onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive ? 'bg-yellow-400 text-blue-900' : 'text-blue-200 hover:bg-blue-800 hover:text-white'
                    }`
                  }>
                  {icon} {label}
                </NavLink>
              ))}
            </div>
          </div>
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
            <span className="hidden md:inline-block text-xs bg-yellow-400 text-blue-900 px-2 py-0.5 rounded-full font-semibold capitalize">
              {user?.role}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle className="hover:bg-gray-100 dark:hover:bg-[#2e3650] text-gray-600 dark:text-gray-300" />
            <NotificationBell />
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              {user?.profilePhoto ? (
                <img src={buildImageUrl(user.profilePhoto, 80)} alt={user.name}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-100 dark:ring-blue-900/40" />
              ) : (
                <div className="w-8 h-8 bg-blue-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
              )}
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
