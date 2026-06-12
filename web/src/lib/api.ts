'use client';

// API client with automatic token refresh (rotating refresh tokens).
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1';

export function getTokens() {
  if (typeof window === 'undefined') return { access: null, refresh: null };
  return {
    access: localStorage.getItem('pcfo_access'),
    refresh: localStorage.getItem('pcfo_refresh'),
  };
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem('pcfo_access', access);
  localStorage.setItem('pcfo_refresh', refresh);
}

export function clearTokens() {
  localStorage.removeItem('pcfo_access');
  localStorage.removeItem('pcfo_refresh');
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
export const post = <T = any>(path: string, body?: any) => api<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
export const patch = <T = any>(path: string, body: any) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const put = <T = any>(path: string, body: any) => api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' });
