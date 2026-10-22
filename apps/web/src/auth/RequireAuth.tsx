import { Navigate, Outlet } from 'react-router-dom';
import { Header } from '../components/Header';
import { useAuth } from './AuthContext';

export function RequireAuth() {
  const { staff } = useAuth();
  if (!staff) return <Navigate to="/login" replace />;
  return (
    <>
      <Header />
      <Outlet />
    </>
  );
}
