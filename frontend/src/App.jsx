import { Routes, Route, Link } from 'react-router-dom';
import Layout from './components/Layout';
import AdminPage from './pages/AdminPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import AuthForm from './pages/AuthForm';
import RequireAccount from './components/RequireAccount';
import CatalogPage from './pages/CatalogPage';
import RecipePage from './pages/RecipePage';
import ProfilePage from './pages/ProfilePage';
import EditorPage from './pages/EditorPage';
import ModerationPage from './pages/ModerationPage';

export default function App() {
  return <Layout><Routes>
    <Route path="/admin" element={<RequireAccount admin><AdminPage/></RequireAccount>}/>
    <Route path="/reports" element={<RequireAccount><ReportsPage/></RequireAccount>}/>
    <Route path="/settings" element={<RequireAccount><SettingsPage/></RequireAccount>}/>
    <Route path="/login" element={<AuthForm/>}/>
    <Route path="/register" element={<AuthForm register/>}/>
    <Route path="/" element={<CatalogPage/>}/>
    <Route path="/recipes/:id" element={<RecipePage/>}/>
    <Route path="/recipes/:id/edit" element={<RequireAccount><EditorPage/></RequireAccount>}/>
    <Route path="/create" element={<RequireAccount><EditorPage/></RequireAccount>}/>
    <Route path="/profile" element={<RequireAccount><ProfilePage/></RequireAccount>}/>
    <Route path="/favorites" element={<RequireAccount><ProfilePage view="favorites"/></RequireAccount>}/>
    <Route path="/moderation" element={<RequireAccount admin><ModerationPage/></RequireAccount>}/>
    <Route path="*" element={<div className="container narrow-page"><div className="empty-state"><span>🥐</span><h2>Страница не найдена</h2><p>Кажется, этот рецепт ещё не придумали.</p><Link className="btn btn-primary" to="/">На главную</Link></div></div>}/>
  </Routes></Layout>;
}
