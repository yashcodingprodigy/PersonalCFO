'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Wordmark } from '@/components/Logo';
import { inr } from '@/lib/format';
import { caGet, caPost, caPatch, caDownloadFile, subscribeCaEvents, getCaTokens } from '@/lib/caApi';
import { CaThread, fileToBase64, type Msg, type Doc } from '@/components/CaThread';
import { ChecklistPanel } from '@/components/ChecklistPanel';

// Reads the client link id from `?id=` (query param, not a path segment) so the
// page stays a single static route — required for the Capacitor mobile build
// (`output: 'export'`). Web + mobile share this file.
export default function CaClient() {
  const router = useRouter();
  const [id, setId] = useState('');
  const [ov, setOv] = useState<any>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [chk, setChk] = useState<any>(null);
  const [draft, setDraft] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => { try { setId(new URLSearchParams(window.location.search).get('id') || ''); } catch {} }, []);

  function loadMsgs() { caGet(`/ca/clients/${id}/messages`).then(setMessages).catch(() => {}); }
  function loadDocs() { caGet(`/ca/clients/${id}/documents`).then(setDocs).catch(() => {}); }
  function loadChk() { caGet(`/ca/clients/${id}/checklist`).then(setChk).catch(() => {}); }
  async function toggleChk(key: string, _field: 'sent' | 'received', value: boolean) { await caPatch(`/ca/clients/${id}/checklist`, { key, received: value }); loadChk(); }
  useEffect(() => {
    if (!id) return;
    if (!getCaTokens().access) { router.replace('/ca/login'); return; }
    caGet(`/ca/clients/${id}/overview`).then((d) => { setOv(d); loadMsgs(); loadDocs(); loadChk(); }).catch((e) => setErr(e.message));
    const refresh = () => { loadMsgs(); loadDocs(); loadChk(); };
    const unsub = subscribeCaEvents(refresh);
    const t = setInterval(() => { if (!document.hidden) refresh(); }, 8000);
    return () => { clearInterval(t); unsub(); };
  }, [id, router]);

  async function send(text: string) { await caPost(`/ca/clients/${id}/messages`, { body: text }); loadMsgs(); }
  async function upload(file: File) { const { data, mime } = await fileToBase64(file); await caPost(`/ca/clients/${id}/documents`, { file_name: file.name, mime_type: mime, data }); loadDocs(); }
  async function download(docId: string) { const d = docs.find((x) => x.document_id === docId); await caDownloadFile(`/ca/clients/${id}/documents/${docId}/file`, d?.file_name || 'document'); }
  function requestDoc(_key: string, name: string) {
    setDraft(`Hi, could you please share your ${name} for the ITR? 🙏`);
    chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // CA-side client summary report (download as text).
  function downloadReport() {
    if (!ov) return;
    const R = (v: number) => `₹${Math.round((v || 0) / 100).toLocaleString('en-IN')}`;
    const ff = ov.fullFiling; const rec = ff ? (ff.recommendedRegime === 'old' ? ff.old : ff.new) : null;
    const L = [
      `PayWatch — Client Summary (CA copy)`, `Client: ${ov.client.name} · ${ov.client.mobile}`,
      `${[ov.client.city, ov.client.state].filter(Boolean).join(', ')} · ${ov.client.employment_type || ''} · ${ov.client.dependents || 0} dependents`,
      `Generated: ${new Date().toLocaleString('en-IN')}`, '',
      `Money Health Score: ${ov.score}/100`,
      `Net worth: ${R(ov.netWorth)} (assets ${R(ov.totalAssets)}, liabilities ${R(ov.totalLiabilities)})`,
      `Income: gross ${R(ov.income.annualGross)}/yr, take-home ${R(ov.income.monthlyTakeHome)}/mo`, '',
    ];
    if (ff && rec) {
      L.push(`TAX — FY ${ff.fy} · ${ff.form.code} (${ff.form.name}) · ${ff.recommendedRegime} regime`,
        `  Gross total income:   ${R(rec.grossTotalIncome)}`,
        `  Total deductions:     ${R(rec.deductions)}`,
        `  Taxable income:       ${R(rec.totalIncome)}`,
        `  Total tax:            ${R(rec.totalTax)}`,
        `  Taxes paid:           ${R(rec.taxesPaid)}`,
        `  ${rec.refundOrPayable >= 0 ? 'Refund due' : 'Tax payable'}:           ${R(Math.abs(rec.refundOrPayable))}`,
        ff.needsCA?.required ? `  NOTE: ${ff.needsCA.reason}` : '', '');
    }
    L.push(`Insurance — term ${R(ov.insurance.term.current)} / rec ${R(ov.insurance.term.recommended)}; health ${R(ov.insurance.health.current)} / rec ${R(ov.insurance.health.recommended)}`,
      `Monthly records on file: ${(ov.monthlyRecords || []).length}`, '',
      `Computed from the client's self-reported data + uploads. Verify against Form 26AS/AIS before filing.`);
    const blob = new Blob([L.filter((x: any) => x !== undefined).join('\n')], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `client-summary-${(ov.client.name || 'client').replace(/\s+/g, '-')}.txt`; a.click();
  }

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
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl font-medium">{ov.client.name}</h1>
            <p className="text-sm text-ink-soft mt-1">{[[ov.client.city, ov.client.state].filter(Boolean).join(', '), ov.client.age ? `${ov.client.age} yrs` : '', ov.client.employment_type?.replace(/_/g, ' '), ov.client.dependents ? `${ov.client.dependents} dependents` : 'no dependents', ov.client.mobile].filter(Boolean).join(' · ')}</p>
            <p className="text-xs text-ink-faint mt-0.5">{[ov.client.email, ov.client.risk_appetite && `${ov.client.risk_appetite} risk profile`].filter(Boolean).join(' · ')}</p>
          </div>
          <button onClick={downloadReport} className="rounded-full bg-pine-900 text-white px-4 py-2 text-xs font-bold hover:bg-pine-800 shrink-0">Download client summary</button>
        </div>

        {/* Snapshot */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Money score</p><p className="font-display text-2xl font-semibold mt-1">{ov.score}/100</p></div>
          <div className="card p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Net worth</p><p className="font-display text-2xl font-semibold mt-1">{inr(ov.netWorth)}</p></div>
          <div className="card p-5"><p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Est. tax</p><p className="font-display text-2xl font-semibold mt-1">{inr(tp.estimatedTax)}</p></div>
        </div>

        {/* Income */}
        <div className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Income</h2>
          <dl className="grid sm:grid-cols-3 gap-x-8 gap-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Gross / year</dt><dd className="font-semibold tabular-nums">{inr(ov.income.annualGross)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Take-home / mo</dt><dd className="font-semibold tabular-nums">{inr(ov.income.monthlyTakeHome)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Expenses / mo</dt><dd className="font-semibold tabular-nums">{ov.income.monthlyExpenses != null ? inr(ov.income.monthlyExpenses) : '—'}</dd></div>
          </dl>
        </div>

        {/* Regime comparison */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2"><h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">Old vs new regime</h2><span className="chip bg-mint-100 text-pine-800 capitalize">Recommended: {ov.regimes.recommended}</span></div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {(['old', 'new'] as const).map((r) => (
              <div key={r} className={`rounded-xl border p-4 ${ov.regimes.recommended === r ? 'border-pine-700 bg-pine-900/5' : 'border-paper-200'}`}>
                <p className="font-bold capitalize mb-1.5">{r} regime</p>
                <div className="flex justify-between"><span className="text-ink-soft">Deductions</span><span className="tabular-nums">{inr(ov.regimes[r].totalDeductions)}</span></div>
                <div className="flex justify-between"><span className="text-ink-soft">Taxable</span><span className="tabular-nums">{inr(ov.regimes[r].taxableIncome)}</span></div>
                <div className="flex justify-between font-semibold mt-1"><span>Tax</span><span className="tabular-nums">{inr(ov.regimes[r].tax)}</span></div>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-soft mt-3">{ov.regimes.reasoning}</p>
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
            <div className="flex justify-between"><dt className="text-ink-soft">HRA exemption</dt><dd className="font-semibold tabular-nums">{inr(ov.hraExemption)}</dd></div>
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

        {/* Full ITR computation — all income heads */}
        {ov.fullFiling && (() => {
          const ff = ov.fullFiling; const rec = ff.recommendedRegime === 'old' ? ff.old : ff.new; const i = ff.inputs;
          const rows: [string, number][] = ([
            ['Salary (gross)', i.grossSalary], ['Interest', i.interestIncome], ['House property', i.housePropertyIncome],
            ['Other (dividends)', i.otherIncome], ['Business', i.businessIncome], ['STCG (equity)', i.stcgEquity],
            ['LTCG (equity)', i.ltcgEquity], ['Other capital gains', i.otherCapitalGains],
          ] as [string, number][]).filter(([, v]) => v);
          return (
            <div className="card p-6">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">Full ITR computation</h2>
                <span className="chip bg-pine-900 text-white">{ff.form.code} · {ff.form.name}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <div>
                  {rows.map(([l, v]) => <div key={l} className="flex justify-between"><span className="text-ink-soft">{l}</span><span className="tabular-nums">{inr(v)}</span></div>)}
                  <div className="flex justify-between font-semibold border-t border-paper-100 pt-1 mt-1"><span>Gross total income</span><span className="tabular-nums">{inr(rec.grossTotalIncome)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-soft">Deductions ({ff.recommendedRegime})</span><span className="tabular-nums">−{inr(rec.deductions)}</span></div>
                </div>
                <div>
                  <div className="flex justify-between"><span className="text-ink-soft">Taxable income</span><span className="tabular-nums">{inr(rec.totalIncome)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-soft">Total tax</span><span className="tabular-nums">{inr(rec.totalTax)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-soft">Taxes paid</span><span className="tabular-nums">−{inr(rec.taxesPaid)}</span></div>
                  <div className="flex justify-between font-semibold border-t border-paper-100 pt-1 mt-1"><span>{rec.refundOrPayable >= 0 ? 'Refund due' : 'Tax payable'}</span><span className={`tabular-nums ${rec.refundOrPayable >= 0 ? 'text-signal-green' : 'text-signal-red'}`}>{inr(Math.abs(rec.refundOrPayable))}</span></div>
                </div>
              </div>
              <p className="text-xs text-ink-soft mt-2">{ff.form.why}</p>
              {ff.carryForward && (ff.carryForward.businessLoss || ff.carryForward.housePropertyLoss || ff.carryForward.stcl || ff.carryForward.ltcl) > 0 && (
                <p className="text-[11px] text-ink-soft mt-2">Carry-forward losses: {[
                  ff.carryForward.stcl > 0 && `STCL ${inr(ff.carryForward.stcl)}`,
                  ff.carryForward.ltcl > 0 && `LTCL ${inr(ff.carryForward.ltcl)}`,
                  ff.carryForward.housePropertyLoss > 0 && `HP ${inr(ff.carryForward.housePropertyLoss)}`,
                  ff.carryForward.businessLoss > 0 && `Business ${inr(ff.carryForward.businessLoss)}`,
                ].filter(Boolean).join(' · ')}</p>
              )}
              {ff.needsCA?.required && <p className="text-[11px] text-signal-amber mt-2">{ff.needsCA.reason}</p>}
            </div>
          );
        })()}

        {/* Assets & liabilities */}
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Assets</h2>
            <ul className="space-y-1.5 text-sm">
              {ov.assets?.length ? ov.assets.map((a: any, i: number) => (<li key={i} className="flex justify-between"><span className="text-ink-soft">{a.label}</span><span className="tabular-nums">{inr(a.value)}</span></li>)) : <li className="text-ink-faint">None recorded.</li>}
            </ul>
            <p className="flex justify-between text-sm font-semibold border-t border-paper-100 mt-2 pt-2"><span>Total assets</span><span className="tabular-nums">{inr(ov.totalAssets)}</span></p>
          </div>
          <div className="card p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Liabilities</h2>
            <ul className="space-y-1.5 text-sm">
              {ov.liabilities?.length ? ov.liabilities.map((l: any, i: number) => (<li key={i} className="flex justify-between"><span className="text-ink-soft">{l.label}</span><span className="tabular-nums">{inr(l.value)}</span></li>)) : <li className="text-ink-faint">None recorded.</li>}
            </ul>
            <p className="flex justify-between text-sm font-semibold border-t border-paper-100 mt-2 pt-2"><span>Total liabilities</span><span className="tabular-nums">{inr(ov.totalLiabilities)}</span></p>
          </div>
        </div>

        {/* Insurance */}
        <div className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Insurance cover</h2>
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Term life</dt><dd className="tabular-nums">{inr(ov.insurance.term.current)} <span className="text-ink-faint">/ {inr(ov.insurance.term.recommended)} rec.</span></dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Health</dt><dd className="tabular-nums">{inr(ov.insurance.health.current)} <span className="text-ink-faint">/ {inr(ov.insurance.health.recommended)} rec.</span></dd></div>
          </dl>
        </div>

        {/* Monthly records — the client's recurring uploads (read-only) */}
        {ov.monthlyRecords?.length > 0 && (
          <div className="card p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Monthly records</h2>
            <div className="space-y-4">
              {Object.entries(
                (ov.monthlyRecords as any[]).reduce((acc: Record<string, any[]>, r) => { (acc[r.period] ||= []).push(r); return acc; }, {})
              ).map(([prd, recs]) => (
                <div key={prd}>
                  <p className="text-xs font-bold text-ink-soft mb-1.5">{new Date(prd + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
                  <ul className="divide-y divide-paper-100">
                    {(recs as any[]).map((r) => (
                      <li key={r.record_id} className="flex items-center justify-between gap-2 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{r.label}</p>
                          {r.summary && <p className="text-[11px] text-ink-faint truncate">{r.summary}</p>}
                        </div>
                        {r.has_file && (
                          <button onClick={() => caDownloadFile(`/ca/clients/${id}/records/${r.record_id}/file`, r.file_name || 'document')} className="text-xs text-pine-700 underline shrink-0">Open</button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink-faint mt-3">Uploaded by the client and encrypted. Cross-check against Form 26AS/AIS before filing.</p>
          </div>
        )}

        {/* ITR filing workflow */}
        {chk?.filingSteps && (
          <div className="card p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">ITR filing workflow</h2>
            <ol className="space-y-2 text-sm text-ink-soft leading-relaxed list-decimal list-inside">
              {chk.filingSteps.map((s: string, i: number) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        )}

        {/* Shared document checklist */}
        {chk?.documents && <ChecklistPanel role="ca" documents={chk.documents} state={chk.state || {}} onToggle={toggleChk} onRequest={requestDoc} />}

        <div ref={chatRef}>
          <CaThread role="ca" messages={messages} onSend={send} docs={docs} onUpload={upload} onDownload={download} initialDraft={draft} />
        </div>
      </div>
    </main>
  );
}
