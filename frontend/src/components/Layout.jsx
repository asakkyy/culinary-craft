import AuthForm from '../pages/AuthForm';
import Avatar from './Avatar';
import Modal from './Modal';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChefHat,
  Heart,
  Plus,
  ShieldCheck,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Menu,
  X,
  Settings,
  LogOut,
  UserRound,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Layout({ children }) {
  const { user, pickerOpen, setPickerOpen, toast, logout, showError } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const account = useRef(null);
  const trigger = useRef(null);
  const mobileTrigger = useRef(null);
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname, location.hash]);
  useEffect(() => {
    setAccountOpen(false);
    setMobileOpen(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (!mobileOpen) return;
    const close = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        mobileTrigger.current?.focus();
      }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [mobileOpen]);
  useEffect(() => {
    if (!accountOpen) return;
    account.current?.querySelector('[role="menuitem"]')?.focus();
    const outside = (e) => {
      if (!account.current?.contains(e.target)) setAccountOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [accountOpen]);
  const closeMenu = () => {
    setAccountOpen(false);
    trigger.current?.focus();
  };
  function menuKeys(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) && accountOpen) {
      e.preventDefault();
      const items = [...account.current.querySelectorAll('[role="menuitem"]')];
      const index = items.indexOf(document.activeElement);
      items[
        e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      ]?.focus();
    }
    if (e.key === 'Tab') {
      trigger.current?.focus();
      setAccountOpen(false);
    }
  }
  return (
    <div
      className="site-shell"
      onClickCapture={(event) => {
        // WebKit does not focus buttons on pointer activation. Keep dialog openers
        // in the focus history before their click handler mounts a modal.
        const button = event.target.closest?.('button');
        if (button && !button.disabled) button.focus({ preventScroll: true });
      }}
    >
      <a href="#main-content" className="skip-link">
        К содержимому
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" aria-label="Culinary Craft — главная">
            <ChefHat strokeWidth={1.5} aria-hidden="true" />
            <span>
              Culinary Craft<small>Книга домашней кухни</small>
            </span>
          </Link>
          <button
            ref={mobileTrigger}
            className="icon-button mobile-menu-toggle"
            aria-label="Основное меню"
            aria-controls="main-nav"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          <nav id="main-nav" className={`main-nav ${mobileOpen ? 'is-open' : ''}`} aria-label="Основная навигация">
            <NavLink to="/" end>
              Рецепты
            </NavLink>
            <NavLink to="/favorites">
              <Heart aria-hidden="true" /> Избранное
            </NavLink>
            <NavLink to="/profile">
              <BookOpen aria-hidden="true" /> Моя кухня
            </NavLink>
            {user?.role === 'ADMIN' && (
              <NavLink to="/admin">
                <ShieldCheck aria-hidden="true" /> Управление
              </NavLink>
            )}
          </nav>
          <div className="header-actions">
            <button className="btn btn-primary nav-create" onClick={() => (user ? navigate('/create') : setPickerOpen(true))}>
              <Plus aria-hidden="true" /> Добавить рецепт
            </button>
            {user ? (
              <div className="account" ref={account} onKeyDown={menuKeys}>
                <button
                  ref={trigger}
                  className="user-chip"
                  aria-label={`Меню аккаунта: ${user.name}`}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  aria-controls="account-menu"
                  onClick={() => setAccountOpen(!accountOpen)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' && !accountOpen) {
                      e.preventDefault();
                      e.stopPropagation();
                      setAccountOpen(true);
                    }
                  }}
                >
                  <Avatar user={user} />
                  <span className="user-chip-name">{user.name.split(' ')[0]}</span>
                  <ChevronDown aria-hidden="true" />
                </button>
                {accountOpen && (
                  <div id="account-menu" role="menu" aria-label="Аккаунт" className="account-menu">
                    <div className="menu-identity">
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                    </div>
                    <Link role="menuitem" to="/profile">
                      <UserRound aria-hidden="true" /> Мой профиль
                    </Link>
                    <Link role="menuitem" to="/settings">
                      <Settings aria-hidden="true" /> Настройки
                    </Link>
                    {user.role === 'ADMIN' && (
                      <Link role="menuitem" to="/admin">
                        <ShieldCheck aria-hidden="true" /> Администрирование
                      </Link>
                    )}
                    <hr />
                    <button
                      role="menuitem"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await logout();
                          closeMenu();
                          navigate('/');
                        } catch (e) {
                          showError(e);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <LogOut aria-hidden="true" /> {busy ? 'Выходим…' : 'Выйти'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="guest-actions">
                <Link to="/login">Войти</Link>
                <Link className="btn btn-outline" to="/register">
                  Регистрация
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
      {user?.emailVerified === false && (
        <div className="verification-notice">
          <div className="container">
            <span>Подтвердите email, чтобы публиковать рецепты, отзывы и жалобы</span>
            <Link to="/resend-verification">Подтвердить адрес</Link>
          </div>
        </div>
      )}
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <Link to="/" className="footer-brand">
              <ChefHat aria-hidden="true" /> Culinary Craft
            </Link>
            <p>Рецепты, которые хочется повторить</p>
          </div>
          <nav className="footer-links" aria-label="Ссылки в подвале">
            <Link to="/">Каталог</Link>
            <Link to="/favorites">Избранное</Link>
            <Link to="/profile">Моя кухня</Link>
          </nav>
          <div className="footer-note">Домашняя кухня. Общий стол.</div>
        </div>
      </footer>
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          {toast.type === 'error' ? <AlertCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          {toast.message}
        </div>
      )}
      {pickerOpen && (
        <Modal title="Вход в Culinary Craft" onClose={() => setPickerOpen(false)}>
          <AuthForm />
        </Modal>
      )}
    </div>
  );
}
