import { Users, Home, UserCog, Lock, Megaphone, Settings, BarChart3, ShieldAlert, Server, HelpCircle } from 'lucide-react';

// Único mapeo de área → ícono/color de Audit Log. La clave string ('users', 'home', ...)
// la decide el backend (server/src/constants/auditTaxonomy.js, ICONS_BY_AREA) — este
// archivo solo traduce esa clave a un ícono real de lucide-react. Devuelve el elemento ya
// instanciado (no el componente) — mismo patrón que categoryIcon en BuzonAdminPage —
// porque exponer `<Icon/>` con `Icon` resuelto dinámicamente dispara la regla de lint
// react-hooks/static-components (piensa que se "crea un componente en cada render").
export function renderAuditIcon(iconKey, size = 16) {
  switch (iconKey) {
    case 'users':
      return <Users size={size} />;
    case 'home':
      return <Home size={size} />;
    case 'user-cog':
      return <UserCog size={size} />;
    case 'lock':
      return <Lock size={size} />;
    case 'megaphone':
      return <Megaphone size={size} />;
    case 'settings':
      return <Settings size={size} />;
    case 'bar-chart':
      return <BarChart3 size={size} />;
    case 'shield-alert':
      return <ShieldAlert size={size} />;
    case 'server':
      return <Server size={size} />;
    default:
      return <HelpCircle size={size} />;
  }
}

// Color de acento por área — mismo criterio "no abusar de colores" del pedido: un tono
// suave por área, no un color distinto por acción/resultado (eso ya lo cubre el Badge de
// resultado). Seguridad usa rojo a propósito, coherente con que sus eventos son críticos.
const COLOR_BY_AREA = {
  CRM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Propiedades: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  Usuarios: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  Autenticación: 'bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300',
  Marketing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Configuración: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  Analytics: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  Seguridad: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Sistema: 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300',
};

export function getAuditAreaColor(area) {
  return COLOR_BY_AREA[area] || COLOR_BY_AREA.Sistema;
}
