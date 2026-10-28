'use client';

// Full-page Ask PayWatch (history + long conversations). Everywhere else in the
// app, Ask PayWatch opens as an overlay on the current page (see Assistant.tsx).
import { useEffect, useState } from 'react';
import { ChatPanel } from '@/components/assistant/ChatPanel';
import { clearCache } from '@/lib/api';
import { useAssistant } from '@/components/assistant/Assistant';

export default function AskPage() {
  const { runActions } = useAssistant();
  const [q, setQ] = useState<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search).get('q');
      if (qs) { setQ(qs); window.history.replaceState({}, '', '/ask'); }
    } catch {}
    setReady(true);
  }, []);
  if (!ready) return null;
  return <ChatPanel variant="page" initialQuestion={q} onDataChanged={() => clearCache()} onActions={(a) => runActions(a)} />;
}
