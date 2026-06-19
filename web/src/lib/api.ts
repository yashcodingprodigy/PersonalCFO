'use client';

// API client with automatic token refresh (rotating refresh tokens).
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1';

export function getTokens() {
  if (typeof window === 'undefined') return { access: null, refresh: null };
  return {
    access: localStorage.getItem('paywatch_access'),
    refresh: localStorage.getItem('paywatch_refresh'),
  };
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem('paywatch_access', access);
  localStorage.setItem('paywatch_refresh', refresh);
}

export function clearTokens() {
  localStorage.removeItem('paywatch_access');
  localStorage.removeItem('paywatch_refresh');
  clearCache();
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function tryRefresh(): Promise<boolean> {
  const { refresh } = getTokens();
  if (!refresh) return false;
  const res = await fetch(`${BASE}/auth/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) { clearTokens(); return false; }
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return true;
}

export async function api<T = any>(path: string, opts: RequestInit = {}, retried = false): Promise<T> {
  const { access } = getTokens();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    const ok = await tryRefresh();
    if (ok) return api<T>(path, opts, true);
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new ApiError(401, 'unauthorised', 'Session expired');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'error', data.message || 'Request failed');
  return data as T;
}

export const get = <T = any>(path: string) => api<T>(path);
// Writes mutate server state, so they clear the read cache (next read is fresh).
export const post = <T = any>(path: string, body?: any) => api<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }).then(bust<T>);
export const patch = <T = any>(path: string, body: any) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) }).then(bust<T>);
export const put = <T = any>(path: string, body: any) => api<T>(path, { method: 'PUT', body: JSON.stringify(body) }).then(bust<T>);
export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' }).then(bust<T>);

// ── Read cache (stale-while-revalidate) ─────────────────────────────
// Pages refetch from the DB on every navigation, which feels slow. This caches
// GET responses in memory + sessionStorage so a revisit renders instantly from
// cache, then refreshes in the background. Any write (post/patch/put/del)
// clears the cache, so you never act on stale numbers.
type CacheEntry = { data: any; ts: number };
const mem = new Map<string, CacheEntry>();
const SS_KEY = 'paywatch_cache_';

function readCache(path: string): CacheEntry | null {
  if (mem.has(path)) return mem.get(path)!;
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SS_KEY + path);
    if (!raw) return null;
    const e = JSON.parse(raw) as CacheEntry;
    mem.set(path, e);
    return e;
  } catch { return null; }
}
function writeCache(path: string, data: any) {
  const e = { data, ts: Date.now() };
  mem.set(path, e);
  try { sessionStorage.setItem(SS_KEY + path, JSON.stringify(e)); } catch {}
}
export function clearCache() {
  mem.clear();
  if (typeof window === 'undefined') return;
  try {
    Object.keys(sessionStorage).filter((k) => k.startsWith(SS_KEY)).forEach((k) => sessionStorage.removeItem(k));
  } catch {}
}
function bust<T>(v: T): T { clearCache(); return v; }

// Stale-while-revalidate: calls onData immediately with any cached value, then
// fetches fresh and calls onData again. Use in place of `get(...).then(setX)`.
// `ttlMs`: if the cached value is younger than this, skip the network entirely.
export async function swr<T = any>(path: string, onData: (d: T) => void, ttlMs = 0): Promise<void> {
  const cached = readCache(path);
  if (cached) onData(cached.data as T);
  if (cached && ttlMs > 0 && Date.now() - cached.ts < ttlMs) return; // fresh enough
  try {
    const fresh = await get<T>(path);
    writeCache(path, fresh);
    onData(fresh);
  } catch (e) {
    if (!cached) throw e; // only surface the error if we had nothing to show
  }
}
