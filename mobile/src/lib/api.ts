// API client for the native app: same server as the web app (api.paywatch.in/v1).
// Tokens live in the device keychain / keystore (expo-secure-store), never in plain storage.
// Rotating refresh tokens with a single in-flight refresh; GET responses are cached in memory
// so screens render instantly on revisit, and any write clears the cache.
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

export const API_URL: string =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ||
  ((Constants.expoConfig?.extra as any)?.apiUrl as string) ||
  'https://api.paywatch.in/v1';
export const WEB_URL = 'https://paywatch.in';

const K_ACCESS = 'paywatch_access';
const K_REFRESH = 'paywatch_refresh';
let access: string | null = null;
let refresh: string | null = null;
let loaded = false;

export async function loadTokens() {
  if (loaded) return { access, refresh };
  try {
    access = await SecureStore.getItemAsync(K_ACCESS);
    refresh = await SecureStore.getItemAsync(K_REFRESH);
  } catch { access = refresh = null; }
  loaded = true;
  return { access, refresh };
}
export const hasSession = () => !!(access || refresh);
export const getRefreshToken = () => refresh;
export const getAccessToken = () => access;

export async function setTokens(a: string, r: string) {
  access = a; refresh = r; loaded = true;
  await SecureStore.setItemAsync(K_ACCESS, a);
  await SecureStore.setItemAsync(K_REFRESH, r);
}
export async function clearTokens() {
  access = refresh = null; clearCache();
  await SecureStore.deleteItemAsync(K_ACCESS).catch(() => {});
  await SecureStore.deleteItemAsync(K_REFRESH).catch(() => {});
}

// Signed-out handler (set by the auth provider) — called when refresh fails.
let onSignedOut: (() => void) | null = null;
export const setSignedOutHandler = (fn: () => void) => { onSignedOut = fn; };

export class ApiError extends Error {
  status: number; code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (!refresh) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/token/refresh`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
        });
        if (!res.ok) { await clearTokens(); return false; }
        const d = await res.json();
        await setTokens(d.access_token, d.refresh_token);
        return true;
      } catch { return false; }
      finally { setTimeout(() => { refreshing = null; }, 0); }
    })();
  }
  return refreshing;
}

const NET_MSG = 'Can’t reach PayWatch. Check your internet connection and try again.';

export async function api<T = any>(path: string, opts: { method?: string; body?: any; timeoutMs?: number } = {}, retried = false): Promise<T> {
  await loadTokens();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 30000);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) },
      body: opts.body === undefined ? undefined : typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body),
      signal: ctl.signal,
    });
  } catch (e: any) {
    throw new ApiError(0, 'network', NET_MSG);
  } finally { clearTimeout(timer); }
  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    if (await tryRefresh()) return api<T>(path, opts, true);
    await clearTokens(); onSignedOut?.();
    throw new ApiError(401, 'unauthorised', 'Your session has ended. Please sign in again.');
  }
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || 'error', data.message || friendly(res.status, data.error));
  return data as T;
}
function friendly(status: number, code?: string) {
  if (status === 429) return 'Too many tries — please wait a minute.';
  if (status === 402 || code === 'upgrade_required') return 'This needs a paid plan.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return code ? String(code).replace(/_/g, ' ') : 'Request failed';
}

/** POST JSON, get binary back (voice audio). Null on any failure. */
export async function apiBinary(path: string, body: any, retried = false): Promise<ArrayBuffer | null> {
  await loadTokens();
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) },
      body: JSON.stringify(body),
    });
    if (res.status === 401 && !retried) { if (await tryRefresh()) return apiBinary(path, body, true); return null; }
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch { return null; }
}

// ── cache + change notifications ────────────────────────────────────
const cache = new Map<string, { data: any; ts: number }>();
export function clearCache() { cache.clear(); }
export function cached<T = any>(path: string): T | undefined { return cache.get(path)?.data; }

type Listener = () => void;
const listeners = new Set<Listener>();
/** Subscribe to "data changed" (any write, or the assistant changed something). */
export function onDataChanged(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function notifyDataChanged() { clearCache(); listeners.forEach((l) => { try { l(); } catch {} }); }

export async function get<T = any>(path: string): Promise<T> {
  const d = await api<T>(path);
  cache.set(path, { data: d, ts: Date.now() });
  return d;
}
const write = <T,>(method: string) => async (path: string, body?: any): Promise<T> => {
  const d = await api<T>(path, { method, body: body ?? {} });
  notifyDataChanged();
  return d;
};
export const post = <T = any>(path: string, body?: any) => write<T>('POST')(path, body);
export const patch = <T = any>(path: string, body?: any) => write<T>('PATCH')(path, body);
export const put = <T = any>(path: string, body?: any) => write<T>('PUT')(path, body);
export const del = <T = any>(path: string) => write<T>('DELETE')(path);
/** POST that reads (no cache bust) — e.g. price guide, afford check, file parse. */
export const ask = <T = any>(path: string, body?: any, timeoutMs?: number) => api<T>(path, { method: 'POST', body: body ?? {}, timeoutMs });
