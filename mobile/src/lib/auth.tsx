// Session state for the app: signed out → login; signed in but onboarding not done → onboarding; else the app.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearTokens, get, getRefreshToken, loadTokens, setSignedOutHandler, setTokens, hasSession } from './api';

export interface Me {
  user_id: string; name?: string; email?: string; mobile?: string; email_verified?: boolean; language?: 'en' | 'hi';
  city?: string; state?: string; age?: number; employment_type?: string; annual_gross_income?: number; monthly_take_home?: number;
  dependents_count?: number; risk_appetite?: string; plan?: string; plan_status?: string; onboarding_status?: Record<string, string>;
}
type Status = 'loading' | 'out' | 'in';
interface Ctx {
  status: Status; me: Me | null;
  signIn: (res: { access_token: string; refresh_token: string; user?: any }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<Me | null>;
  needsOnboarding: boolean;
}
const AuthCtx = createContext<Ctx>({} as Ctx);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<Me | null>(null);

  const refreshMe = useCallback(async () => {
    try { const u = await get<Me>('/user/me'); setMe(u); return u; } catch { return null; }
  }, []);

  useEffect(() => {
    setSignedOutHandler(() => { setMe(null); setStatus('out'); });
    (async () => {
      await loadTokens();
      if (!hasSession()) { setStatus('out'); return; }
      const u = await refreshMe();
      setStatus(u ? 'in' : hasSession() ? 'in' : 'out');
    })();
  }, [refreshMe]);

  const signIn = useCallback(async (res: { access_token: string; refresh_token: string; user?: any }) => {
    await setTokens(res.access_token, res.refresh_token);
    if (res.user) setMe(res.user);
    await refreshMe();
    setStatus('in');
  }, [refreshMe]);

  const signOut = useCallback(async () => {
    const r = getRefreshToken();
    if (r) await api('/auth/logout', { method: 'POST', body: { refresh_token: r } }).catch(() => {});
    await clearTokens();
    setMe(null); setStatus('out');
  }, []);

  const needsOnboarding = !!me && (me.onboarding_status?.session_1 !== 'complete');
  const value = useMemo(() => ({ status, me, signIn, signOut, refreshMe, needsOnboarding }), [status, me, signIn, signOut, refreshMe, needsOnboarding]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
