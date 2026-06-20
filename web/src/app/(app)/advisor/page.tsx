'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get, post, del } from '@/lib/api';

export default function AdvisorPage() {
  const [data, setData] = useState<any>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function load() { get('/user/ca').then(setData).catch((e) => setErr(e.message)); }
  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 8000);
    return () => clearInterval(t);
  }, []);

  async function connect(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try { const r = await post('/user/ca/connect', { code }); setMsg(r.message); setCode(''); load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function act(path: string, method: 'post' | 'del') {
    try { method === 'post' ? await post(path) : await del(path); load(); } catch (e: any) { setErr(e.message); }
  }
  function copyCode() {
    if (!data?.connect_code) return;
    navigator.clipboard?.writeText(data.connect_code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  const links = data?.links || [];
  const pending = links.filter((l: any) => l.status === 'pending' && l.initiated_by === 'ca');
  const sent = links.filter((l: any) => l.status === 'pending' && l.initiated_by === 'user');
  const active = links.filter((l: any) => l.status === 'active');

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-medium">Your CA</h1>
        <p className="text-sm text-ink-soft mt-1">Connect with your Chartered Accountant to share your computed tax pack and documents — securely, only after you both approve.</p>
      </div>

      {/* My code */}
      <div className="card p-6 bg-pine-950 text-white">
        <p className="text-[11px] font-bold uppercase tracking-widest text-mint-300">Your connect code</p>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <span className="font-display text-3xl font-semibold tracking-widest">{data?.connect_code || '——'}</span>
          <button onClick={copyCode} className="rounded-full bg-mint-500 text-pine-950 px-4 py-1.5 text-xs font-bold hover:bg-mint-400 transition-colors">{copied ? 'Copied ✓' : 'Copy'}</button>
        </div>
        <p className="text-xs text-white/60 mt-3">Share this with your CA so they can request a connection — you’ll approve it here.</p>
      </div>

      {/* Connect by CA code */}
      <form onSubmit={connect} className="card p-6 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">Connect to a CA</h2>
        <p className="text-sm text-ink-soft">Have your CA’s code? Enter it to send a connection request.</p>
        <div className="flex gap-2">
          <input className="input flex-1 tracking-widest" placeholder="CA-XXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="btn-primary !px-5" disabled={busy || code.length < 3}>Request</button>
        </div>
        {msg && <p className="text-sm text-signal-green">{msg}</p>}
        {err && <p className="text-sm text-signal-red">{err}</p>}
      </form>

      {/* Pending requests from a CA */}
      {pending.length > 0 && (
        <div className="card p-6 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-signal-amber">Requests to approve</h2>
          {pending.map((l: any) => (
            <div key={l.link_id} className="flex items-center justify-between gap-3 flex-wrap border-b border-paper-100 pb-3 last:border-0 last:pb-0">
              <div><p className="font-semibold text-sm">{l.ca_name}</p><p className="text-xs text-ink-faint">{[l.firm_name, l.city, l.icai_number && `ICAI ${l.icai_number}`].filter(Boolean).join(' · ')}</p></div>
              <div className="flex gap-2">
                <button onClick={() => act(`/user/ca/links/${l.link_id}/approve`, 'post')} className="rounded-full bg-mint-500 text-pine-950 px-4 py-1.5 text-xs font-bold">Approve</button>
                <button onClick={() => act(`/user/ca/links/${l.link_id}/reject`, 'post')} className="rounded-full border border-paper-200 px-4 py-1.5 text-xs font-semibold text-ink-soft">Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Connected */}
      <div className="card p-6 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">Connected CAs</h2>
        {active.length === 0 && sent.length === 0 && <p className="text-sm text-ink-soft">No CA connected yet.</p>}
        {active.map((l: any) => (
          <div key={l.link_id} className="flex items-center justify-between gap-3 flex-wrap border-b border-paper-100 pb-3 last:border-0 last:pb-0">
            <Link href={`/advisor/${l.link_id}`} className="min-w-0 group"><p className="font-semibold text-sm group-hover:text-pine-700">{l.ca_name} <span className="chip bg-mint-100 text-pine-800 ml-1">Connected</span> <span className="text-xs text-pine-700">— message & share →</span></p><p className="text-xs text-ink-faint">{[l.firm_name, l.city].filter(Boolean).join(' · ')}</p></Link>
            <button onClick={() => act(`/user/ca/links/${l.link_id}`, 'del')} className="text-xs text-signal-red underline shrink-0">Disconnect</button>
          </div>
        ))}
        {sent.map((l: any) => (
          <div key={l.link_id} className="flex items-center justify-between gap-3 flex-wrap border-b border-paper-100 pb-3 last:border-0 last:pb-0">
            <div><p className="font-semibold text-sm">{l.ca_name} <span className="chip bg-signal-amber/10 text-signal-amber ml-1">Request sent</span></p></div>
            <button onClick={() => act(`/user/ca/links/${l.link_id}`, 'del')} className="text-xs text-ink-faint underline">Cancel</button>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-ink-faint leading-relaxed">A CA only sees what you share once both sides approve, and you can disconnect anytime — which immediately stops further sharing.</p>
    </div>
  );
}
