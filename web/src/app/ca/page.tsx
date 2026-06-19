'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wordmark } from '@/components/Logo';
import { caGet, getCaTokens, clearCaTokens } from '@/lib/caApi';

export default function CaHome() {
  const router = useRouter();
  const [ca, setCa] = useState<any>(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!getCaTokens().access) { router.replace('/ca/login'); return; }
    caGet('/ca/me').then(setCa).catch(() => { clearCaTokens(); router.replace('/ca/login'); });
  }, [router]);

  function logout() { clearCaTokens(); router.replace('/ca/login'); }
  function copyCode() {
    if (!ca?.connect_code) return;
    navigator.clipboard?.writeText(ca.connect_code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  if (err) return <p className="text-signal-red text-sm m-8">{err}</p>;
  if (!ca) return <div className="min-h-screen bg-paper animate-pulse" />;

  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-pine-950 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><Wordmark dark size="sm" /><span className="text-[10px] uppercase tracking-wider text-mint-300 font-bold">CA</span></div>
        <button onClick={logout} className="text-xs text-white/60 underline">Sign out</button>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-medium">Hi, {ca.name?.replace(/^CA\s+/i, '') || 'there'} 👋</h1>
          <p className="text-sm text-ink-soft mt-1">{ca.firm_name ? `${ca.firm_name} · ` : ''}{ca.city || ''}{ca.icai_number ? ` · ICAI ${ca.icai_number}` : ''}</p>
        </div>

        {/* Connect code */}
        <div className="card p-6 bg-pine-950 text-white">
          <p className="text-[11px] font-bold uppercase tracking-widest text-mint-300">Your CA connect code</p>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <span className="font-display text-3xl font-semibold tracking-widest">{ca.connect_code}</span>
            <button onClick={copyCode} className="rounded-full bg-mint-500 text-pine-950 px-4 py-1.5 text-xs font-bold hover:bg-mint-400 transition-colors">{copied ? 'Copied ✓' : 'Copy'}</button>
          </div>
          <p className="text-xs text-white/60 mt-3 leading-relaxed">Share this code with a client. They enter it in their PayWatch app to request a connection — and you approve it. (Connecting clients is coming in the next update.)</p>
        </div>

        {/* Counts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-6"><p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Active clients</p><p className="font-display text-3xl font-semibold mt-1">{ca.active_clients ?? 0}</p></div>
          <div className="card p-6"><p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Pending requests</p><p className="font-display text-3xl font-semibold mt-1">{ca.pending_requests ?? 0}</p></div>
        </div>

        <div className="card p-6 text-sm text-ink-soft leading-relaxed">
          <p className="font-semibold text-ink mb-1">Coming next</p>
          Connecting with clients, viewing their shared documents and computed tax packs, and in-app messaging are on the way. Your account and connect code are ready now.
        </div>
      </div>
    </main>
  );
}
