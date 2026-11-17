import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, errorText } from '../api/client';

const Context = createContext(null);
export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [dataVersion, setDataVersion] = useState(0);
  const generation = useRef(0);
  const pending = useRef(null);
  const channel = useRef(null);
  // Share simultaneous reads (including StrictMode setup); never cache an account across mutations.
  const readSession = useCallback((fresh = false) => {
    if (fresh) pending.current = null;
    if (!pending.current) {
      const request = api.me().finally(() => {
        if (pending.current === request) pending.current = null;
      });
      pending.current = request;
    }
    return pending.current;
  }, []);
  const publish = useCallback(() => channel.current?.postMessage('account-changed'), []);
  const changed = useCallback(() => setDataVersion((count) => count + 1), []);
  const notify = useCallback((message, type = 'success') => setToast({ message, type }), []);
  const forgetUser = useCallback(() => {
    generation.current += 1;
    pending.current = null;
    setUser(null);
    setPickerOpen(false);
    changed();
    publish();
  }, [changed, publish]);
  useEffect(() => {
    let active = true;
    const epoch = generation.current;
    readSession()
      .then((account) => {
        if (active && epoch === generation.current) setUser(account);
      })
      .catch(() => {
        if (active && epoch === generation.current) setUser(null);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });
    return () => {
      active = false;
    };
  }, [readSession]);
  useEffect(() => {
    let active = true;
    const sync = () => {
      if (document.visibilityState === 'hidden') return;
      const epoch = generation.current;
      readSession()
        .then((account) => {
          if (active && epoch === generation.current)
            setUser((current) => (JSON.stringify(current) === JSON.stringify(account) ? current : account));
        })
        .catch((error) => {
          if (active && epoch === generation.current && error.response?.status === 401) {
            generation.current += 1;
            setUser(null);
            setPickerOpen(false);
            changed();
          }
        });
    };
    const expired = () => {
      forgetUser();
      setPickerOpen(true);
    };
    const messages = typeof BroadcastChannel === 'function' ? new BroadcastChannel('culinary-account') : null;
    channel.current = messages;
    if (messages) messages.onmessage = sync;
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('cc-session-expired', expired);
    return () => {
      active = false;
      messages?.close();
      channel.current = null;
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('cc-session-expired', expired);
    };
  }, [changed, forgetUser, readSession]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  const login = useCallback(
    async (data) => {
      generation.current += 1;
      const epoch = generation.current;
      pending.current = null;
      const account = await api.login(data);
      if (epoch !== generation.current) return;
      setUser(account);
      setPickerOpen(false);
      changed();
      publish();
    },
    [changed, publish],
  );
  const logout = useCallback(async () => {
    generation.current += 1;
    pending.current = null;
    try {
      await api.logout();
    } catch (error) {
      if (error.response?.status !== 401) throw error;
    }
    forgetUser();
  }, [forgetUser]);
  const refreshUser = useCallback(async () => {
    const epoch = ++generation.current;
    const account = await readSession(true);
    if (epoch !== generation.current) return null;
    setUser(account);
    changed();
    publish();
    return account;
  }, [changed, publish, readSession]);
  const showError = useCallback(
    (error) => {
      if (error.response?.status === 401) {
        forgetUser();
        setPickerOpen(true);
      }
      notify(errorText(error), 'error');
    },
    [forgetUser, notify],
  );
  const requireUser = useCallback(() => {
    if (!user) {
      setPickerOpen(true);
      return false;
    }
    if (user.emailVerified === false) {
      notify('Подтвердите email перед изменением контента. Ссылка находится вверху страницы.', 'error');
      return false;
    }
    return true;
  }, [notify, user]);
  const value = useMemo(
    () => ({
      refreshUser,
      forgetUser,
      user,
      authLoading,
      login,
      logout,
      pickerOpen,
      setPickerOpen,
      toast,
      notify,
      showError,
      changed,
      dataVersion,
      requireUser,
    }),
    [refreshUser, forgetUser, user, authLoading, login, logout, pickerOpen, toast, notify, showError, changed, dataVersion, requireUser],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useApp() {
  return useContext(Context);
}
