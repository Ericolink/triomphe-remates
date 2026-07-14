import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import Spinner from './components/ui/Spinner';

// Páginas públicas — cargadas de forma diferida para no bloquear el primer render
const HomePage             = lazy(() => import('./pages/public/HomePage'));
const PropertiesPage       = lazy(() => import('./pages/public/PropertiesPage'));
const PropertyDetailPage   = lazy(() => import('./pages/public/PropertyDetailPage'));
const ContactPage          = lazy(() => import('./pages/public/ContactPage'));
const AboutPage            = lazy(() => import('./pages/public/AboutPage'));
const JobsPage             = lazy(() => import('./pages/public/JobsPage'));
const BuzonPage            = lazy(() => import('./pages/public/BuzonPage'));
const FavoritesPage        = lazy(() => import('./pages/public/FavoritesPage'));
const ComparatorPage       = lazy(() => import('./pages/public/ComparatorPage'));
const UnsubscribeAlertPage = lazy(() => import('./pages/public/UnsubscribeAlertPage'));
const FAQPage              = lazy(() => import('./pages/public/FAQPage'));

// Panel admin — en un chunk separado para que nunca llegue a visitantes anónimos
const LoginPage            = lazy(() => import('./pages/admin/LoginPage'));
const AdminLayout          = lazy(() => import('./components/layout/AdminLayout'));
const DashboardPage        = lazy(() => import('./pages/admin/DashboardPage'));
const EstadisticasPage     = lazy(() => import('./pages/admin/EstadisticasPage'));
const AdminPropertiesPage  = lazy(() => import('./pages/admin/AdminPropertiesPage'));
const PropertyFormPage     = lazy(() => import('./pages/admin/PropertyFormPage'));
const LeadsPage            = lazy(() => import('./pages/admin/LeadsPage'));
const JobsAdminPage        = lazy(() => import('./pages/admin/JobsAdminPage'));
const ApplicationsPage     = lazy(() => import('./pages/admin/ApplicationsPage'));
const UsersPage            = lazy(() => import('./pages/admin/UsersPage'));
const BuzonAdminPage       = lazy(() => import('./pages/admin/BuzonAdminPage'));
const AlertsAdminPage      = lazy(() => import('./pages/admin/AlertsAdminPage'));
const AuditPage            = lazy(() => import('./pages/admin/AuditPage'));
const CalendarPage         = lazy(() => import('./pages/admin/CalendarPage'));
const TestimonialsAdminPage = lazy(() => import('./pages/admin/TestimonialsAdminPage'));

import PublicLayout from './components/layout/PublicLayout';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/admin/login" replace />;
};

const PageFallback = () => <Spinner size="lg" className="py-40" />;

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/"                     element={<HomePage />} />
            <Route path="/propiedades"          element={<PropertiesPage />} />
            <Route path="/propiedades/:slug"    element={<PropertyDetailPage />} />
            <Route path="/contacto"             element={<ContactPage />} />
            <Route path="/nosotros"             element={<AboutPage />} />
            <Route path="/trabaja-con-nosotros" element={<JobsPage />} />
            <Route path="/buzon"                element={<BuzonPage />} />
            <Route path="/favoritos"            element={<FavoritesPage />} />
            <Route path="/comparar"             element={<ComparatorPage />} />
            <Route path="/cancelar-alerta"      element={<UnsubscribeAlertPage />} />
            <Route path="/preguntas-frecuentes" element={<FAQPage />} />
          </Route>

          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard"              element={<DashboardPage />} />
            <Route path="estadisticas"           element={<EstadisticasPage />} />
            <Route path="propiedades"            element={<AdminPropertiesPage />} />
            <Route path="propiedades/nueva"      element={<PropertyFormPage />} />
            <Route path="propiedades/:id/editar" element={<PropertyFormPage />} />
            <Route path="leads"                  element={<LeadsPage />} />
            <Route path="vacantes"               element={<JobsAdminPage />} />
            <Route path="postulaciones"          element={<ApplicationsPage />} />
            <Route path="usuarios"               element={<UsersPage />} />
            <Route path="buzon"                  element={<BuzonAdminPage />} />
            <Route path="alertas"                element={<AlertsAdminPage />} />
            <Route path="auditoria"              element={<AuditPage />} />
            <Route path="calendario"             element={<CalendarPage />} />
            <Route path="testimonios"            element={<TestimonialsAdminPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
