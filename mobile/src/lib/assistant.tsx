// Ask PayWatch, everywhere in the app. Voice and chat share ONE conversation, and the
// assistant can act: open a screen, pin a "do / avoid" guide, refresh data, switch language.
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { notifyDataChanged } from './api';
import { useLang } from './i18n';
import { nativeRoute } from './routes';

export interface Guide { page: string; title: string; intro?: string; doThis: string[]; avoid: string[]; footnote?: string }
export type AssistantAction =
  | { type: 'navigate'; path: string; label: string }
  | ({ type: 'guide' } & Guide)
  | { type: 'refresh' }
  | { type: 'set_language'; value: 'en' | 'hi' };

interface Ctx {
  convId: string | null; setConvId: (id: string | null) => void;
  guide: Guide | null; setGuide: (g: Guide | null) => void;
  openChat: (q?: string) => void; openVoice: () => void; newChat: () => void; chatKey: number;
  runActions: (a?: AssistantAction[]) => boolean;
  go: (webPath: string) => void;
}
const C = createContext<Ctx>({} as Ctx);
export const useAssistant = () => useContext(C);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [convId, setConvId] = useState<string | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const { setLang } = useLang();

  const go = useCallback((webPath: string) => {
    const r = nativeRoute(webPath);
    if (r.web) { WebBrowser.openBrowserAsync(r.web).catch(() => {}); return; }
    if (r.route) router.navigate(r.route as any);
  }, []);

  const runActions = useCallback((actions?: AssistantAction[]) => {
    if (!actions?.length) return false;
    let navigated = false;
    for (const a of actions) {
      if (a.type === 'navigate') { go(a.path); navigated = true; }
      else if (a.type === 'guide') { const { type, ...g } = a; setGuide(g as Guide); }
      else if (a.type === 'refresh') notifyDataChanged();
      else if (a.type === 'set_language') setLang(a.value);
    }
    if (navigated && !actions.some((a) => a.type === 'guide')) setGuide(null);
    return navigated;
  }, [go, setLang]);

  const openChat = useCallback((q?: string) => { router.navigate({ pathname: '/ask', params: q ? { q, t: String(Date.now()) } : {} } as any); }, []);
  const openVoice = useCallback(() => { router.push('/voice'); }, []);
  const newChat = useCallback(() => { setConvId(null); setChatKey((k) => k + 1); }, []);

  const value = useMemo(() => ({ convId, setConvId, guide, setGuide, openChat, openVoice, newChat, chatKey, runActions, go }),
    [convId, guide, openChat, openVoice, newChat, chatKey, runActions, go]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
