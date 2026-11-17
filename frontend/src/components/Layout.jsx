import AuthForm from '../pages/AuthForm';
import Avatar from './Avatar';
import { useEffect } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, ChefHat, Heart, Plus, ShieldCheck, UserRound, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

function UserPicker() {
  const { pickerOpen, setPickerOpen } = useApp();
  if (!pickerOpen) return null;
  return <div className="modal-backdrop"><div className="user-modal" role="dialog" aria-modal="true" aria-label="Account">
    <button className="icon-plain" onClick={() => setPickerOpen(false)} aria-label="Close"><X/></button><AuthForm/>
  </div></div>;
}

export default function Layout({ children }) {
  const { user, setPickerOpen, toast } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [location.pathname]);
  const handleCreate = () => { if (!user) setPickerOpen(true); else navigate('/create'); };
  return (
    <div className="site-shell">
      <div className="topline"><span>Вкусные идеи начинаются здесь</span><span>Твоя домашняя книга рецептов <span className="topline-star">✳</span></span></div>
      <header className="site-header"><div className="container header-inner">
        <Link to="/" className="brand"><span className="brand-mark"><ChefHat size={23} strokeWidth={2.3}/></span><span>Culinary<span className="brand-accent">Craft</span><small>ГОТОВЬ С ВДОХНОВЕНИЕМ</small></span></Link>
        <nav className="main-nav" aria-label="Основная навигация">
          <NavLink to="/" end>Рецепты</NavLink>
          <NavLink to="/favorites"><Heart size={17} /> Избранное</NavLink>
          <NavLink to="/profile"><BookOpen size={17} /> Моя кухня</NavLink>
          {user?.role === 'ADMIN' && <NavLink to="/moderation"><ShieldCheck size={17} /> Модерация</NavLink>}
        </nav>
        <div className="header-actions"><button className="btn btn-primary nav-create" onClick={handleCreate}><Plus size={18}/> Добавить рецепт</button>
          <button className="user-chip" onClick={() => setPickerOpen(true)} title="Выбрать демо-пользователя">
            <Avatar user={user}/><span className="user-chip-name">{user ? user.name.split(' ')[0] : 'Гость'}</span><span className="tiny-chevron">⌄</span>
          </button></div>
      </div></header>
      <main>{children}</main>
      <footer className="site-footer"><div className="container footer-inner">
        <div><Link to="/" className="footer-brand"><ChefHat size={25} /> CulinaryCraft</Link><p>Место, где рецепты превращаются в любимые традиции.</p></div>
        <div className="footer-links"><Link to="/">Каталог</Link><Link to="/favorites">Избранное</Link><Link to="/profile">Моя кухня</Link></div>
        <div className="footer-note">Учебный прототип · Лабораторная работа №6<br/>React + Spring Boot · PostgreSQL</div>
      </div></footer>
      {toast && <div className={`toast toast-${toast.type}`} role="status">{toast.type === 'error' ? <AlertCircle size={19}/> : <CheckCircle2 size={19}/>} {toast.message}</div>}
      <UserPicker />
    </div>
  );
}
