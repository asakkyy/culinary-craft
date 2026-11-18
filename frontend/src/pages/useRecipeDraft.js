import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { encodeDraft } from './recipeDraft';

export default function useRecipeDraft(key, initial, snapshot) {
  const [status, setStatus] = useState(initial.inaccessible ? 'error' : '');
  const raw = useRef(initial.raw);
  const latest = useRef(null);
  const persisted = useRef(null);

  useLayoutEffect(() => {
    latest.current = snapshot;
  }, [snapshot]);

  const flush = useCallback(
    (showStatus = true, nextSnapshot = latest.current) => {
      latest.current = nextSnapshot;
      const value = latest.current;
      if (value === persisted.current) return true;
      try {
        // Preserve a draft written in another tab after this editor opened.
        if (localStorage.getItem(key) !== raw.current) throw new Error('Draft changed in another tab');
        if (value) {
          const next = encodeDraft(value);
          localStorage.setItem(key, next);
          raw.current = next;
        } else {
          localStorage.removeItem(key);
          raw.current = null;
        }
        persisted.current = value;
        if (showStatus) setStatus(value ? 'saved' : '');
        return true;
      } catch {
        if (showStatus) setStatus('error');
        return false;
      }
    },
    [key],
  );

  const clear = useCallback((showStatus = true) => {
    latest.current = null;
    persisted.current = null;
    try {
      if (localStorage.getItem(key) !== raw.current) throw new Error('Draft changed in another tab');
      localStorage.removeItem(key);
      raw.current = null;
      if (showStatus) setStatus('');
    } catch {
      if (showStatus) setStatus('error');
    }
  }, [key]);

  useEffect(() => {
    if (!snapshot && !persisted.current) return;
    if (persisted.current !== snapshot && snapshot) setStatus('saving');
    const timer = setTimeout(flush, 400);
    return () => clearTimeout(timer);
  }, [flush, snapshot]);

  useEffect(() => {
    const pageHide = () => flush(false);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', pageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', pageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      flush(false);
    };
  }, [flush]);

  return { status, flush, clear };
}
