'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wordmark } from '@/components/Logo';
import { caGet, caPost, caDel, getCaTokens, clearCaTokens } from '@/lib/caApi';

export default function CaHome() {
  const router = useRouter();
  const [ca, setCa] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  function loadClients() { caGet('/ca/clients').then(setClients).catch(() => {}); }
  useEffect(() => {
    if (!getCaTokens().access) { router.replace('/ca/login'); return; }
    caGet('/ca/me').then((c) => { setCa(c); loadClients(); }).catch(() => { clearCaTokens(); router.replace('/ca/login'); });
    const t = setInterval(() => { if (!document.hidden) { loadClients(); caGet('/ca/me').then(setCa).catch(() => {}); } }, 8000);
    return () => clearInterval(t);
  }, [router]);

  async function connectClient(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    try { const r = await caPost('/ca/clients/connect', { code }); setMsg(r.message); setCode(''); loadClients(); }
    catch (e: any) { setErr(e.message); }
  }
  async function act(path: string, method: 'post' | 'del') {
    try { method === 'post' ? await caPost(path) : await caDel(path); loadClients(); } catch (e: any) { setErr(e.message); }
  }

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

        {/* Connect a client */}
        <form onSubmit={connectClient} className="card p-6 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">Add a client</h2>
          <p className="text-sm text-ink-soft">Enter the connect code your client sees in their PayWatch app (under “Your CA”). They’ll approve the request.</p>
          <div className="flex gap-2">
            <input className="input flex-1 tracking-widest" placeholder="PW-XXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <button className="btn-primary !px-5" disabled={code.length < 3}>Request</button>
          </div>
          {msg && <p className="text-sm text-signal-green">{msg}</p>}
          {err && <p className="text-sm text-signal-red">{err}</p>}
        </form>

        {/* Pending (user-initiated) requests to approve */}
        {clients.some((c) => c.status === 'pending' && c.initiated_by === 'user') && (
          <div className="card p-6 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-signal-amber">Requests to approve</h2>
            {clients.filter((c) => c.status === 'pending' && c.initiated_by === 'user').map((c) => (
              <div key={c.link_id} className="flex items-center justify-between gap-3 flex-wrap border-b border-paper-100 pb-3 last:border-0 last:pb-0">
                <div><p className="font-semibold text-sm">{c.name || c.mobile}</p><p className="text-xs text-ink-faint">{[c.city, c.mobile].filter(Boolean).join(' · ')}</p></div>
                <div className="flex gap-2">
                  <button onClick={() => act(`/ca/clients/${c.link_id}/approve`, 'post')} className="rounded-full bg-mint-500 text-pine-950 px-4 py-1.5 text-xs font-bold">Approve</button>
                  <button onClick={() => act(`/ca/clients/${c.link_id}/reject`, 'post')} className="rounded-full border border-paper-200 px-4 py-1.5 text-xs font-semibold text-ink-soft">Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Client list */}
        <div className="card p-6 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">Your clients</h2>
          {clients.filter((c) => c.status === 'active' || (c.status === 'pending' && c.initiated_by === 'ca')).length === 0 && <p className="text-sm text-ink-soft">No clients yet. Add one with their code above.</p>}
          {clients.filter((c) => c.status === 'active').map((c) => (
            <div key={c.link_id} className="flex items-center justify-between gap-3 flex-wrap border-b border-paper-100 pb-3 last:border-0 last:pb-0">
              <a href={`/ca/client/${c.link_id}`} className="min-w-0 group"><p className="font-semibold text-sm group-hover:text-pine-700">{c.name || c.mobile} <span className="chip bg-mint-100 text-pine-800 ml-1">Connected</span> <span className="text-xs text-pine-700">→</span></p><p className="text-xs text-ink-faint">{[c.city, c.mobile].filter(Boolean).join(' · ')}</p></a>
              <button onClick={() => act(`/ca/clients/${c.link_id}`, 'del')} className="text-xs text-signal-red underline shrink-0">Disconnect</button>
            </div>
          ))}
          {clients.filter((c) => c.status === 'pending' && c.initiated_by === 'ca').map((c) => (
            <div key={c.link_id} className="flex items-center justify-between gap-3 flex-wrap border-b border-paper-100 pb-3 last:border-0 last:pb-0">
              <div><p className="font-semibold text-sm">{c.name || c.mobile} <span className="chip bg-signal-amber/10 text-signal-amber ml-1">Awaiting their approval</span></p></div>
              <button onClick={() => act(`/ca/clients/${c.link_id}`, 'del')} className="text-xs text-ink-faint underline">Cancel</button>
            </div>
          ))}
        </div>

        <div className="card p-6 text-sm text-ink-soft leading-relaxed">
          <p className="font-semibold text-ink mb-1">Coming next</p>
          Viewing each client’s shared documents and computed tax pack, plus in-app messaging.
        </div>
      </div>
    </main>
  );
}
