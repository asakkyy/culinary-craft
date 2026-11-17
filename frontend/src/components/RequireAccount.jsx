import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function RequireAccount({ children, admin = false }) {
  const { user, authLoading } = useApp();
  const location = useLocation();
  if (authLoading) return <p role="status">Загрузка сессии…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }}/>;
  if (admin && user.role !== 'ADMIN') return <div className="error-box">Доступ только для администратора</div>;
  return children;
}
