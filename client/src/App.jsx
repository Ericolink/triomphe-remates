import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import Spinner from './components/ui/Spinner';
import ErrorBoundary from './components/ErrorBoundary';
import {
  defaultRouteFor,
  isAdmin,
  hasCrmAccess,
  hasBackofficeAccess,
  canManageInventory,
  canAccessMyDashboard,
} from './utils/permissions';

// Páginas públicas — cargadas de forma diferida para no bloquear el primer render
const HomePage = lazy(() => import('./pages/public/HomePage'));
const PropertiesPage = lazy(() => import('./pages/public/PropertiesPage'));
const PropertyDetailPage = lazy(() => import('./pages/public/PropertyDetailPage'));
const ContactPage = lazy(() => import('./pages/public/ContactPage'));
const AboutPage = lazy(() => import('./pages/public/AboutPage'));
const ProcessPage = lazy(() => import('./pages/public/ProcessPage'));
const JobsPage = lazy(() => import('./pages/public/JobsPage'));
const BuzonPage = lazy(() => import('./pages/public/BuzonPage'));
const FavoritesPage = lazy(() => import('./pages/public/FavoritesPage'));
const ComparatorPage = lazy(() => import('./pages/public/ComparatorPage'));
const UnsubscribeAlertPage = lazy(() => import('./pages/public/UnsubscribeAlertPage'));
const ManageAlertPage = lazy(() => import('./pages/public/ManageAlertPage'));
const FAQPage = lazy(() => import('./pages/public/FAQPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/public/PrivacyPolicyPage'));

// Panel admin — en un chunk separado para que nunca llegue a visitantes anónimos
const LoginPage = lazy(() => import('./pages/admin/LoginPage'));
const AdminLayout = lazy(() => import('./components/layout/AdminLayout'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const AsesorDashboardPage = lazy(() => import('./pages/admin/AsesorDashboardPage'));
const AdminPropertiesPage = lazy(() => import('./pages/admin/AdminPropertiesPage'));
const PropertyFormPage = lazy(() => import('./pages/admin/PropertyFormPage'));
const CrmPage = lazy(() => import('./pages/admin/CrmPage'));
const JobsAdminPage = lazy(() => import('./pages/admin/JobsAdminPage'));
const ApplicationsPage = lazy(() => import('./pages/admin/ApplicationsPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const BuzonAdminPage = lazy(() => import('./pages/admin/BuzonAdminPage'));
const AlertsAdminPage = lazy(() => import('./pages/admin/AlertsAdminPage'));
const WaitingListPage = lazy(() => import('./pages/admin/WaitingListPage'));
const AuditPage = lazy(() => import('./pages/admin/AuditPage'));
const TestimonialsAdminPage = lazy(() => import('./pages/admin/TestimonialsAdminPage'));

import PublicLayout from './components/layout/PublicLayout';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/admin/login" replace />;
};

// Coordinador de ventas y Asesor de ventas no tienen acceso al dashboard de analytics
// (ver hasBackofficeAccess en utils/permissions.js) — cada rol aterriza en el módulo que
// sí puede usar en vez de pegarle a "/admin/dashboard" y recibir un 403 de por vida.
const DefaultAdminRoute = () => {
  const { user } = useAuthStore();
  return <Navigate to={defaultRouteFor(user)} replace />;
};

// Defensa en profundidad para navegación directa por URL (la SPA ya oculta estos links
// del sidebar según el rol — ver AdminLayout.jsx — pero sin esto quien tipeara la URL a
// mano llegaba a una página que solo mostraba errores 403 en cada request).
const RoleRoute = ({ allow, children }) => {
  const { user } = useAuthStore();
  return allow(user) ? children : <Navigate to={defaultRouteFor(user)} replace />;
};

const PageFallback = () => <Spinner size="lg" className="py-40" />;

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/propiedades" element={<PropertiesPage />} />
              <Route path="/propiedades/:slug" element={<PropertyDetailPage />} />
              <Route path="/contacto" element={<ContactPage />} />
              <Route path="/nosotros" element={<AboutPage />} />
              <Route path="/proceso-adquisicion" element={<ProcessPage />} />
              <Route path="/trabaja-con-nosotros" element={<JobsPage />} />
              <Route path="/buzon" element={<BuzonPage />} />
              <Route path="/favoritos" element={<FavoritesPage />} />
              <Route path="/comparar" element={<ComparatorPage />} />
              <Route path="/cancelar-alerta" element={<UnsubscribeAlertPage />} />
              <Route path="/mi-alerta" element={<ManageAlertPage />} />
              <Route path="/preguntas-frecuentes" element={<FAQPage />} />
              <Route path="/aviso-de-privacidad" element={<PrivacyPolicyPage />} />
            </Route>

            <Route path="/admin/login" element={<LoginPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DefaultAdminRoute />} />
              <Route
                path="dashboard"
                element={
                  <RoleRoute allow={hasBackofficeAccess}>
                    <DashboardPage />
                  </RoleRoute>
                }
              />
              <Route path="estadisticas" element={<Navigate to="/admin/dashboard" replace />} />
              <Route
                path="mi-dashboard"
                element={
                  <RoleRoute allow={canAccessMyDashboard}>
                    <AsesorDashboardPage />
                  </RoleRoute>
                }
              />
              <Route path="propiedades" element={<AdminPropertiesPage />} />
              <Route
                path="propiedades/nueva"
                element={
                  <RoleRoute allow={canManageInventory}>
                    <PropertyFormPage />
                  </RoleRoute>
                }
              />
              <Route
                path="propiedades/:id/editar"
                element={
                  <RoleRoute allow={canManageInventory}>
                    <PropertyFormPage />
                  </RoleRoute>
                }
              />
              <Route
                path="crm"
                element={
                  <RoleRoute allow={hasCrmAccess}>
                    <CrmPage />
                  </RoleRoute>
                }
              />
              <Route path="leads" element={<Navigate to="/admin/crm?tab=prospectos" replace />} />
              <Route
                path="calendario"
                element={<Navigate to="/admin/crm?tab=calendario" replace />}
              />
              <Route path="campanas" element={<Navigate to="/admin/crm?tab=campanas" replace />} />
              <Route
                path="casos-exito"
                element={<Navigate to="/admin/crm?tab=casos-exito" replace />}
              />
              <Route
                path="vacantes"
                element={
                  <RoleRoute allow={hasBackofficeAccess}>
                    <JobsAdminPage />
                  </RoleRoute>
                }
              />
              <Route
                path="postulaciones"
                element={
                  <RoleRoute allow={hasBackofficeAccess}>
                    <ApplicationsPage />
                  </RoleRoute>
                }
              />
              <Route
                path="usuarios"
                element={
                  <RoleRoute allow={isAdmin}>
                    <UsersPage />
                  </RoleRoute>
                }
              />
              <Route
                path="buzon"
                element={
                  <RoleRoute allow={hasBackofficeAccess}>
                    <BuzonAdminPage />
                  </RoleRoute>
                }
              />
              <Route
                path="alertas"
                element={
                  <RoleRoute allow={hasBackofficeAccess}>
                    <AlertsAdminPage />
                  </RoleRoute>
                }
              />
              <Route
                path="lista-espera"
                element={
                  <RoleRoute allow={hasBackofficeAccess}>
                    <WaitingListPage />
                  </RoleRoute>
                }
              />
              <Route
                path="auditoria"
                element={
                  <RoleRoute allow={isAdmin}>
                    <AuditPage />
                  </RoleRoute>
                }
              />
              <Route
                path="testimonios"
                element={
                  <RoleRoute allow={hasBackofficeAccess}>
                    <TestimonialsAdminPage />
                  </RoleRoute>
                }
              />
              <Route
                path="dashboard-comercial"
                element={<Navigate to="/admin/dashboard" replace />}
              />
              <Route path="reportes" element={<Navigate to="/admin/dashboard" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
