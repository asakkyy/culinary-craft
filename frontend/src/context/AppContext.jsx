import { createContext, useContext, useEffect, useState } from 'react';
import { api, errorText } from '../api/client';

const Context = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => { api.me().then(setUser).catch(() => setUser(null)).finally(() => setAuthLoading(false)); }, []);
  useEffect(() => {
    const expired = () => { setUser(null); setPickerOpen(true); setDataVersion(v => v + 1); };
    window.addEventListener('cc-session-expired', expired);
    return () => window.removeEventListener('cc-session-expired', expired);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  const login = async (data) => { const account = await api.login(data); setUser(account); setPickerOpen(false); setDataVersion(v => v + 1); };
  const logout = async () => { try { await api.logout(); } catch (error) { if (error.response?.status !== 401) throw error; } setUser(null); setPickerOpen(false); setDataVersion(v => v + 1); };
  const notify = (message, type = 'success') => setToast({ message, type });
  const showError = (error) => { if (error.response?.status === 401) { setUser(null); setPickerOpen(true); } notify(errorText(error), 'error'); };
  const changed = () => setDataVersion((count) => count + 1);
  const requireUser = () => { if (!user) { setPickerOpen(true); return false; } return true; };

  return (
    <Context.Provider value={{ user, authLoading, login, logout, pickerOpen, setPickerOpen, toast, notify, showError, changed, dataVersion, requireUser }}>
      {children}
    </Context.Provider>
  );
}

export function useApp() { return useContext(Context); }
