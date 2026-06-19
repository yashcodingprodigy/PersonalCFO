'use client';

// CA-side API client. CA tokens are stored separately from user tokens so a
// CA and a user can even be logged in on the same device without clashing.
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1';

export function getCaTokens() {
  if (typeof window === 'undefined') return { access: null as string | null, refresh: null as string | null };
  return { access: localStorage.getItem('paywatch_ca_access'), refresh: localStorage.getItem('paywatch_ca_refresh') };
}
export function setCaTokens(access: string, refresh: string) {
  localStorage.setItem('paywatch_ca_access', access);
  localStorage.setItem('paywatch_ca_refresh', refresh);
}
export function clearCaTokens() {
  localStorage.removeItem('paywatch_ca_access');
  localStorage.removeItem('paywatch_ca_refresh');
}

async function caRefresh(): Promise<boolean> {
  const { refresh } = getCaTokens();
  if (!refresh) return false;
  const res = await fetch(`${BASE}/ca/auth/token/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) { clearCaTokens(); return false; }
  const data = await res.json();
  setCaTokens(data.access_token, data.refresh_token);
  return true;
}

export async function caApi<T = any>(path: string, opts: RequestInit = {}, retried = false): Promise<T> {
  const { access } = getCaTokens();
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}), ...(opts.headers || {}) },
  });
  if (res.status === 401 && !retried && getCaTokens().refresh) {
    if (await caRefresh()) return caApi<T>(path, opts, true);
    clearCaTokens();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).message || 'Request failed');
  return data as T;
}

export const caGet = <T = any>(path: string) => caApi<T>(path);
export const caPost = <T = any>(path: string, body?: any) => caApi<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
