import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';

import HomePage from './pages/public/HomePage';
import PropertiesPage from './pages/public/PropertiesPage';
import PropertyDetailPage from './pages/public/PropertyDetailPage';
import ContactPage from './pages/public/ContactPage';
import AboutPage from './pages/public/AboutPage';
import JobsPage from './pages/public/JobsPage';

import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import AdminPropertiesPage from './pages/admin/AdminPropertiesPage';
import PropertyFormPage from './pages/admin/PropertyFormPage';
import LeadsPage from './pages/admin/LeadsPage';
import JobsAdminPage from './pages/admin/JobsAdminPage';
import ApplicationsPage from './pages/admin/ApplicationsPage';
import UsersPage from './pages/admin/UsersPage';

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
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/propiedades" element={<PropertiesPage />} />
          <Route path="/propiedades/:slug" element={<PropertyDetailPage />} />
          <Route path="/contacto" element={<ContactPage />} />
          <Route path="/nosotros" element={<AboutPage />} />
          <Route path="/trabaja-con-nosotros" element={<JobsPage />} />
        </Route>

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
          <Route path="vacantes" element={<JobsAdminPage />} />
          <Route path="postulaciones" element={<ApplicationsPage />} />
          <Route path="usuarios" element={<UsersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
