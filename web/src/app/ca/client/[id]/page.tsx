'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wordmark } from '@/components/Logo';
import { inr } from '@/lib/format';
import { caGet, caPost, caDownloadFile, subscribeCaEvents, getCaTokens, clearCaTokens } from '@/lib/caApi';
import { CaThread, fileToBase64, type Msg, type Doc } from '@/components/CaThread';

export default function CaClient() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [ov, setOv] = useState<any>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [err, setErr] = useState('');

  function loadMsgs() { caGet(`/ca/clients/${id}/messages`).then(setMessages).catch(() => {}); }
  function loadDocs() { caGet(`/ca/clients/${id}/documents`).then(setDocs).catch(() => {}); }
  useEffect(() => {
    if (!getCaTokens().access) { router.replace('/ca/login'); return; }
    caGet(`/ca/clients/${id}/overview`).then((d) => { setOv(d); loadMsgs(); loadDocs(); }).catch((e) => setErr(e.message));
    const refresh = () => { loadMsgs(); loadDocs(); };
    const unsub = subscribeCaEvents(refresh);
    const t = setInterval(() => { if (!document.hidden) refresh(); }, 8000);
    return () => { clearInterval(t); unsub(); };
  }, [id, router]);

  async function send(text: string) { await caPost(`/ca/clients/${id}/messages`, { body: text }); loadMsgs(); }
  async function upload(file: File) { const { data, mime } = await fileToBase64(file); await caPost(`/ca/clients/${id}/documents`, { file_name: file.name, mime_type: mime, data }); loadDocs(); }
  async function download(docId: string) { const d = docs.find((x) => x.document_id === docId); await caDownloadFile(`/ca/clients/${id}/documents/${docId}/file`, d?.file_name || 'document'); }

  if (err) return <main className="min-h-screen bg-paper p-8"><p className="text-signal-red text-sm">{err}</p><Link href="/ca" className="text-sm text-pine-700 underline">← Back</Link></main>;
  if (!ov) return <main className="min-h-screen bg-paper animate-pulse" />;
  const tp = ov.taxPack;

  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-pine-950 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><Wordmark dark size="sm" /><span className="text-[10px] uppercase tracking-wider text-mint-300 font-bold">CA</span></div>
        <Link href="/ca" className="text-xs text-white/70 underline">← All clients</Link>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-8 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-medium">{ov.client.name}</h1>
          <p className="text-sm text-ink-soft mt-1">{[ov.client.city, ov.client.mobile].filter(Boolean).join(' · ')}</p>
        </div>

        {/* Snapshot */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Money score</p><p className="font-display text-2xl font-semibold mt-1">{ov.score}/100</p></div>
          <div className="card p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Net worth</p><p className="font-display text-2xl font-semibold mt-1">{inr(ov.netWorth)}</p></div>
          <div className="card p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Est. tax</p><p className="font-display text-2xl font-semibold mt-1">{inr(tp.estimatedTax)}</p></div>
        </div>

        {/* Tax pack */}
        <div className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Tax pack ({tp.fy} · {tp.recommendedRegime} regime)</h2>
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Gross income</dt><dd className="font-semibold tabular-nums">{inr(tp.grossIncome)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Total deductions</dt><dd className="font-semibold tabular-nums">{inr(tp.totalDeductions)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Taxable income</dt><dd className="font-semibold tabular-nums">{inr(tp.taxableIncome)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Estimated tax</dt><dd className="font-semibold tabular-nums">{inr(tp.estimatedTax)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Effective rate</dt><dd className="font-semibold tabular-nums">{tp.effectiveRatePct}%</dd></div>
          </dl>
          {tp.deductionItems?.length > 0 && (
            <div className="mt-4 border-t border-paper-100 pt-3">
              <p className="text-xs font-bold text-ink-faint mb-2">Deductions used</p>
              <ul className="space-y-1 text-sm">
                {tp.deductionItems.map((d: any, i: number) => (
                  <li key={i} className="flex justify-between"><span className="text-ink-soft">{d.section}</span><span className="tabular-nums">{inr(d.used)} <span className="text-ink-faint">/ {inr(d.limit)}</span></span></li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-ink-faint mt-3">Computed from the client’s self-entered data. Verify against Form 26AS/AIS before filing.</p>
        </div>

        <CaThread role="ca" messages={messages} onSend={send} docs={docs} onUpload={upload} onDownload={download} />
      </div>
    </main>
  );
}
