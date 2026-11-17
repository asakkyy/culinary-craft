import { Navigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export default function RequireAccount({ children, admin = false, verified = false }) {
  const { user, authLoading } = useApp();
  const location = useLocation();
  if (authLoading) return <p role="status">Загрузка сессии…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && user.role !== 'ADMIN') return <div className="error-box">Доступ только для администратора</div>;
  if (verified && user.emailVerified === false)
    return (
      <section className="container narrow-page auth-page">
        <h1>Подтвердите email</h1>
        <p>
          Для создания и изменения рецептов подтвердите адрес {user.email}. Письмо отправится только после нажатия кнопки на странице
          подтверждения.
        </p>
        <Link className="btn btn-primary" to="/resend-verification">
          Перейти к подтверждению
        </Link>
      </section>
    );
  return children;
}
