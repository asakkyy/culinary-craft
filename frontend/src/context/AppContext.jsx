import { createContext, useContext, useEffect, useState } from 'react';
import { api, errorText } from '../api/client';

const Context = createContext(null);
const initialUser = localStorage.getItem('cc-demo-user') || '1';
if (!localStorage.getItem('cc-demo-user')) localStorage.setItem('cc-demo-user', initialUser);

export function AppProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [activeId, setActiveId] = useState(initialUser);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => { api.users().then(setUsers).catch(() => {}); }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  const user = users.find((item) => String(item.id) === activeId) || null;
  const pickUser = (id) => {
    localStorage.setItem('cc-demo-user', id);
    setActiveId(id);
    setPickerOpen(false);
    setDataVersion((count) => count + 1);
  };
  const notify = (message, type = 'success') => setToast({ message, type });
  const showError = (error) => notify(errorText(error), 'error');
  const changed = () => setDataVersion((count) => count + 1);
  const requireUser = () => { if (!user) { setPickerOpen(true); return false; } return true; };

  return (
    <Context.Provider value={{ users, user, pickUser, pickerOpen, setPickerOpen, toast, notify, showError, changed, dataVersion, requireUser }}>
      {children}
    </Context.Provider>
  );
}

export function useApp() { return useContext(Context); }
