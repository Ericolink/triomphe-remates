import { Outlet, Navigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
export default function AdminLayout() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}
