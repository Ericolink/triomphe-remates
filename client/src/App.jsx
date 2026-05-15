import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';

// Páginas públicas
import HomePage from './pages/public/HomePage';
import PropertiesPage from './pages/public/PropertiesPage';
import PropertyDetailPage from './pages/public/PropertyDetailPage';
import ContactPage from './pages/public/ContactPage';

// Páginas admin
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import AdminPropertiesPage from './pages/admin/AdminPropertiesPage';
import PropertyFormPage from './pages/admin/PropertyFormPage';
import LeadsPage from './pages/admin/LeadsPage';

// Layouts
import PublicLayout from './components/layout/PublicLayout';
import AdminLayout from './components/layout/AdminLayout';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? children : <Navigate to="/admin/login" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas públicas */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/propiedades" element={<PropertiesPage />} />
          <Route path="/propiedades/:slug" element={<PropertyDetailPage />} />
          <Route path="/contacto" element={<ContactPage />} />
        </Route>

        {/* Rutas admin */}
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="propiedades" element={<AdminPropertiesPage />} />
          <Route path="propiedades/nueva" element={<PropertyFormPage />} />
          <Route path="propiedades/:id/editar" element={<PropertyFormPage />} />
          <Route path="leads" element={<LeadsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
