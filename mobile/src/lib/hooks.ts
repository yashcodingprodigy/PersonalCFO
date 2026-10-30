// Data hook: cached-first, refetch on focus-independent "data changed" events, pull-to-refresh.
import { useCallback, useEffect, useRef, useState } from 'react';
import { cached, get, onDataChanged } from './api';

export function useApi<T = any>(path: string | null, opts: { auto?: boolean } = {}) {
  const [data, setData] = useState<T | undefined>(() => (path ? cached<T>(path) : undefined));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!data && !!path);
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(async (pull = false) => {
    const p = pathRef.current; if (!p) return;
    if (pull) setRefreshing(true);
    try {
      const d = await get<T>(p);
      if (alive.current && pathRef.current === p) { setData(d); setError(''); }
    } catch (e: any) {
      if (alive.current) setError(e.message || 'Something went wrong');
    } finally {
      if (alive.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    if (path) { const c = cached<T>(path); if (c) { setData(c); setLoading(false); } else setLoading(true); load(); }
    return () => { alive.current = false; };
  }, [path, load]);

  useEffect(() => {
    if (opts.auto === false) return;
    return onDataChanged(() => { load(); });
  }, [load, opts.auto]);

  return { data, error, loading, refreshing, reload: () => load(true), setData };
}
