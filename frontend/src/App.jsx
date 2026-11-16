import { Routes, Route, Link } from 'react-router-dom';
import Layout from './components/Layout';
import CatalogPage from './pages/CatalogPage';
import RecipePage from './pages/RecipePage';
import ProfilePage from './pages/ProfilePage';
import EditorPage from './pages/EditorPage';
import ModerationPage from './pages/ModerationPage';

export default function App() {
  return <Layout><Routes>
    <Route path="/" element={<CatalogPage/>}/>
    <Route path="/recipes/:id" element={<RecipePage/>}/>
    <Route path="/recipes/:id/edit" element={<EditorPage/>}/>
    <Route path="/create" element={<EditorPage/>}/>
    <Route path="/profile" element={<ProfilePage/>}/>
    <Route path="/favorites" element={<ProfilePage view="favorites"/>}/>
    <Route path="/moderation" element={<ModerationPage/>}/>
    <Route path="*" element={<div className="container narrow-page"><div className="empty-state"><span>🥐</span><h2>Страница не найдена</h2><p>Кажется, этот рецепт ещё не придумали.</p><Link className="btn btn-primary" to="/">На главную</Link></div></div>}/>
  </Routes></Layout>;
}
