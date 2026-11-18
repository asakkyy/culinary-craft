import { Routes, Route, Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/Layout';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import RecoveryPage from './pages/RecoveryPage';
import AuthForm from './pages/AuthForm';
import RequireAccount from './components/RequireAccount';
import CatalogPage from './pages/CatalogPage';
import RecipePage from './pages/RecipePage';
import ProfilePage from './pages/ProfilePage';
const AdminPage = lazy(() => import('./pages/AdminPage'));
const EditorPage = lazy(() => import('./pages/EditorPage'));
const ModerationPage = lazy(() => import('./pages/ModerationPage'));

export default function App() {
  return (
    <Layout>
      <Suspense
        fallback={
          <p className="loading-message" role="status">
            Загружаем страницу…
          </p>
        }
      >
        <Routes>
          <Route path="/forgot-password" element={<RecoveryPage key="forgot" mode="forgot" />} />
          <Route path="/resend-verification" element={<RecoveryPage key="resend" mode="resend" />} />
          <Route path="/verify-email" element={<RecoveryPage key="verify" mode="verify" />} />
          <Route path="/reset-password" element={<RecoveryPage key="reset" mode="reset" />} />
          <Route
            path="/admin"
            element={
              <RequireAccount admin>
                <AdminPage />
              </RequireAccount>
            }
          />
          <Route
            path="/reports"
            element={
              <RequireAccount>
                <ReportsPage />
              </RequireAccount>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAccount>
                <SettingsPage />
              </RequireAccount>
            }
          />
          <Route path="/login" element={<AuthForm key="login" />} />
          <Route path="/register" element={<AuthForm key="register" register />} />
          <Route path="/" element={<CatalogPage />} />
          <Route path="/recipes/:id" element={<RecipePage />} />
          <Route
            path="/recipes/:id/edit"
            element={
              <RequireAccount verified>
                <EditorPage />
              </RequireAccount>
            }
          />
          <Route
            path="/create"
            element={
              <RequireAccount verified>
                <EditorPage />
              </RequireAccount>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAccount>
                <ProfilePage />
              </RequireAccount>
            }
          />
          <Route
            path="/favorites"
            element={
              <RequireAccount>
                <ProfilePage view="favorites" />
              </RequireAccount>
            }
          />
          <Route
            path="/moderation"
            element={
              <RequireAccount admin>
                <ModerationPage />
              </RequireAccount>
            }
          />
          <Route
            path="*"
            element={
              <div className="container narrow-page">
                <div className="empty-state">
                  <h1>Страница не найдена</h1>
                  <p>Проверьте адрес или вернитесь в каталог рецептов.</p>
                  <Link className="btn btn-primary" to="/">
                    На главную
                  </Link>
                </div>
              </div>
            }
          />
        </Routes>
      </Suspense>
    </Layout>
  );
}
