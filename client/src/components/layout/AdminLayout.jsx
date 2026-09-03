import { useId, useState } from 'react';
import { Outlet, NavLink, useNavigate, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  LogOut,
  Menu,
  Briefcase,
  UserCheck,
  ShieldCheck,
  MessageSquare,
  Bell,
  ClipboardList,
  MessageSquareQuote,
  KeyRound,
  ChevronDown,
  Clock,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import NotificationBell from '../ui/NotificationBell';
import ThemeToggle from '../ui/ThemeToggle';
import ChangePasswordModal from '../admin/ChangePasswordModal';
import { buildImageUrl } from '../../utils/images';
import toast from 'react-hot-toast';
import useModalA11y from '../../hooks/useModalA11y';
import usePopoverA11y from '../../hooks/usePopoverA11y';
import { hasCrmAccess, hasBackofficeAccess } from '../../utils/permissions';
import { ROLE_LABELS } from '../../utils/constants';

// Agrupado por tema (en vez de una lista plana de 11 ítems) para que la ubicación de
// cada sección sea predecible sin tener que leer cada label — ver auditoría UX admin.
// Dashboard y Propiedades se separan del resto porque tienen su propia regla de
// visibilidad (ver Sidebar): Dashboard es de soporte (admin/asistente_administrativo),
// Propiedades lo ve cualquier rol (con distinto nivel de acceso dentro de la página).
const dashboardGroup = {
  label: null,
  links: [{ to: '/admin/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' }],
};

// Dashboard personal de asesor_ventas / de equipo de coordinador_ventas — distinto de
// dashboardGroup (dashboard admin, datos de toda la empresa). Solo visible para esos 2
// roles, ver Sidebar más abajo.
const asesorDashboardGroup = {
  label: null,
  links: [{ to: '/admin/mi-dashboard', icon: <LayoutDashboard size={18} />, label: 'Mi Dashboard' }],
};

const propertiesGroup = {
  label: 'Propiedades',
  links: [{ to: '/admin/propiedades', icon: <Building2 size={18} />, label: 'Propiedades' }],
};

// Módulos de soporte — solo Admin y Asistente administrativo (ver hasBackofficeAccess).
// Coordinador de ventas y Asesor de ventas no los ven.
const backofficeGroups = [
  {
    label: 'Comunicación',
    links: [
      { to: '/admin/buzon', icon: <MessageSquare size={18} />, label: 'Buzón de opiniones' },
      { to: '/admin/alertas', icon: <Bell size={18} />, label: 'Alertas de propiedad' },
      { to: '/admin/lista-espera', icon: <Clock size={18} />, label: 'Lista de espera' },
    ],
  },
  {
    label: 'Reclutamiento',
    links: [
      { to: '/admin/vacantes', icon: <Briefcase size={18} />, label: 'Vacantes' },
      { to: '/admin/postulaciones', icon: <UserCheck size={18} />, label: 'Postulaciones' },
    ],
  },
  {
    label: 'Contenido',
    links: [
      { to: '/admin/testimonios', icon: <MessageSquareQuote size={18} />, label: 'Testimonios' },
    ],
  },
];

const crmGroup = {
  label: 'CRM Comercial',
  links: [{ to: '/admin/crm', icon: <Users size={18} />, label: 'CRM Comercial' }],
};

const adminOnlyGroup = {
  label: 'Sistema',
  links: [
    { to: '/admin/usuarios', icon: <ShieldCheck size={18} />, label: 'Usuarios' },
    { to: '/admin/auditoria', icon: <ClipboardList size={18} />, label: 'Auditoría' },
  ],
};

function Sidebar({ user, onClose, onLogout }) {
  // El CRM se oculta para quien no tiene hasCrmAccess: sin esto, el link llevaba a una
  // pantalla que solo mostraba errores 403 en cada request, porque requireCrmAccess en el
  // backend ya la bloquea por completo. Lo mismo para los módulos de soporte
  // (Comunicación/Reclutamiento/Contenido/Dashboard) con hasBackofficeAccess.
  const groups = [
    ...(hasBackofficeAccess(user) ? [dashboardGroup] : []),
    ...(['asesor_ventas', 'coordinador_ventas'].includes(user?.role) ? [asesorDashboardGroup] : []),
    propertiesGroup,
    ...(hasCrmAccess(user) ? [crmGroup] : []),
    ...(hasBackofficeAccess(user) ? backofficeGroups : []),
    ...(user?.role === 'admin' ? [adminOnlyGroup] : []),
  ];
  return (
    <div className="flex flex-col h-full bg-primary-900 text-white w-64">
      <div className="p-6 border-b border-primary-800">
        <a href="/" target="_blank" rel="noopener noreferrer" title="Ver sitio público">
          <img
            src="/logo.png"
            alt="Triomphe"
            className="h-25 w-auto brightness-0 invert hover:opacity-80 transition-opacity"
          />
        </a>
      </div>

      <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="px-4 mb-1 text-xs font-semibold uppercase tracking-wider text-primary-300/70">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.links.map(({ to, icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-accent-400 text-primary-900'
                        : 'text-primary-200 hover:bg-primary-800 hover:text-white'
                    }`
                  }
                >
                  {icon} {label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-primary-800">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-sm font-medium text-primary-200 hover:bg-primary-800 hover:text-white transition-colors"
        >
          <LogOut size={18} /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const titleId = useId();
  const { panelRef, triggerRef } = usePopoverA11y(open, () => setOpen(false));

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={triggerRef}
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 rounded-xl px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-[#2e3650] transition-colors"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Menú de usuario"
      >
        {user?.profilePhoto ? (
          <img
            src={buildImageUrl(user.profilePhoto, 80)}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-primary-100 dark:ring-primary-900/40"
          />
        ) : (
          <div className="w-8 h-8 bg-primary-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
        )}
        <span className="hidden md:block font-medium">{user?.name}</span>
        <ChevronDown size={14} className="hidden md:block text-gray-400" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="region"
          aria-labelledby={titleId}
          className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#242938] rounded-2xl shadow-xl border border-gray-100 dark:border-[#2e3650] z-20 overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-gray-100 dark:border-[#2e3650]">
            <p id={titleId} className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">
              {user?.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
          </div>
          <div className="p-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPasswordModalOpen(true);
              }}
              className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
            >
              <KeyRound size={15} aria-hidden="true" /> Cambiar contraseña
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
            >
              <LogOut size={15} aria-hidden="true" /> Cerrar sesión
            </button>
          </div>
        </div>
      )}

      <ChangePasswordModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} />
    </div>
  );
}

export default function AdminLayout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panelRef = useModalA11y(open, () => setOpen(false));

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
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            tabIndex={-1}
            className="flex-shrink-0"
          >
            <Sidebar user={user} onClose={() => setOpen(false)} onLogout={handleLogout} />
          </div>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="flex-1 bg-black/50"
            onClick={() => setOpen(false)}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-[#242938] border-b border-gray-200 dark:border-[#2e3650] px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1 text-gray-600 dark:text-gray-300"
              onClick={() => setOpen(true)}
              aria-label="Abrir menú"
              aria-expanded={open}
            >
              <Menu size={22} aria-hidden="true" />
            </button>
            <span className="hidden md:inline-block text-xs bg-accent-400 text-primary-900 px-2 py-0.5 rounded-full font-semibold">
              {ROLE_LABELS[user?.role] || user?.role}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle className="hover:bg-gray-100 dark:hover:bg-[#2e3650] text-gray-600 dark:text-gray-300" />
            <NotificationBell />
            <UserMenu user={user} onLogout={handleLogout} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
