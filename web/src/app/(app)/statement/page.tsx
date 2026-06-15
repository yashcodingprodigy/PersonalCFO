'use client';

import { useState } from 'react';
import Link from 'next/link';
import { post } from '@/lib/api';
import { inr } from '@/lib/format';
import { parseStatementFile } from '@/lib/statementParse';
import { UpgradeBanner } from '@/components/UpgradeBanner';

const SEV: Record<string, string> = {
  high: 'bg-signal-red/10 text-signal-red',
  medium: 'bg-signal-amber/10 text-signal-amber',
  low: 'bg-paper-100 text-ink-soft',
};

export default function StatementPage() {
  const [stage, setStage] = useState<'idle' | 'parsing' | 'ready' | 'analyzing' | 'done'>('idle');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<any[]>([]);
  const [warning, setWarning] = useState('');
  const [persist, setPersist] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [imported, setImported] = useState(0);
  const [err, setErr] = useState('');

  async function handleFile(file: File) {
    setErr(''); setWarning(''); setReport(null); setStage('parsing'); setFileName(file.name);
    try {
      const res = await parseStatementFile(file);
      setParsed(res.transactions);
      setWarning(res.warning || '');
      setStage('ready');
    } catch (e: any) { setErr(e.message); setStage('idle'); }
  }

  async function analyze() {
    setStage('analyzing'); setErr('');
    try {
      const res = await post('/statements/analyze', { transactions: parsed, persist });
      setReport(res.report); setImported(res.imported || 0); setStage('done');
    } catch (e: any) { setErr(e.message); setStage('ready'); }
  }

  function reset() {
    setStage('idle'); setParsed([]); setReport(null); setWarning(''); setErr(''); setFileName('');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium">Statement scan</h1>
        <p className="text-sm text-ink-soft mt-1">Upload a bank statement and get a plain-English breakdown: where your money went, what you invested, and where to cut.</p>
      </div>

      <UpgradeBanner feature="Unlimited statement scans and the spending watchdog" />

      {/* Upload box */}
      {stage !== 'done' && (
        <section className="card p-6">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            className="flex flex-col items-center justify-center border-2 border-dashed border-paper-200 rounded-xl py-12 px-6 text-center cursor-pointer hover:border-pine-600 transition-colors"
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-pine-700"><path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" /></svg>
            <p className="mt-3 text-sm font-semibold">{stage === 'parsing' ? 'Reading your file…' : 'Drop your statement here, or click to choose'}</p>
            <p className="text-xs text-ink-faint mt-1">CSV, Excel (.xlsx) or PDF · processed on your device</p>
            <input type="file" accept=".csv,.txt,.xlsx,.xls,.pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </label>
          <p className="text-[11px] text-ink-faint mt-3 leading-relaxed">
            Your statement is parsed entirely in your browser — the file itself is never uploaded. Only the extracted transaction rows are sent to generate your report. CSV/Excel give the most accurate results; PDF is best-effort as bank layouts vary.
          </p>
        </section>
      )}

      {err && <p className="text-sm text-signal-red">{err}</p>}

      {/* Ready to analyse */}
      {stage === 'ready' && (
        <section className="card p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-semibold">{fileName}</p>
              <p className="text-xs text-ink-soft">{parsed.length} transaction{parsed.length === 1 ? '' : 's'} read</p>
            </div>
            <button onClick={reset} className="text-xs text-ink-faint underline">Choose a different file</button>
          </div>
          {warning && <div className="rounded-lg bg-signal-amber/10 text-signal-amber text-xs px-4 py-3 leading-relaxed">{warning}</div>}
          {parsed.length > 0 && (
            <>
              <div className="max-h-48 overflow-auto rounded-lg border border-paper-200 text-xs">
                <table className="w-full">
                  <thead className="bg-paper-100 text-ink-faint sticky top-0"><tr><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Description</th><th className="text-right px-3 py-2">Amount</th></tr></thead>
                  <tbody>
                    {parsed.slice(0, 50).map((t, i) => (
                      <tr key={i} className="border-t border-paper-100">
                        <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{t.date}</td>
                        <td className="px-3 py-1.5 truncate max-w-[280px]">{t.description}</td>
                        <td className={`px-3 py-1.5 text-right tabular-nums ${t.direction === 'credit' ? 'text-signal-green' : ''}`}>{t.direction === 'credit' ? '+' : '−'}{inr(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label className="flex items-center gap-2 text-xs text-ink-soft">
                <input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} />
                Also save these to update my Money Health Score (recommended)
              </label>
              <button onClick={analyze} disabled={(stage as string) === 'analyzing'} className="btn-primary">
                {(stage as string) === 'analyzing' ? 'Analysing…' : 'Generate my report'}
              </button>
            </>
          )}
        </section>
      )}

      {/* Report */}
      {stage === 'done' && report && (
        <Report report={report} imported={imported} onReset={reset} />
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className={`font-display text-2xl font-semibold mt-1 tabular-nums ${accent || ''}`}>{value}</p>
    </div>
  );
}

function Report({ report: r, imported, onReset }: { report: any; imported: number; onReset: () => void }) {
  const sr = r.totals.savingsRate;
  return (
    <div className="space-y-6">
      <div className="card p-5 border-l-4 border-l-mint-500 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-pine-700 mb-1">Your statement, summarised</p>
          <p className="text-sm text-ink-soft leading-relaxed">{r.summary}</p>
          {imported > 0 && <p className="text-xs text-signal-green mt-2">{imported} transactions saved — your Money Health Score has been updated.</p>}
        </div>
        <button onClick={onReset} className="btn-secondary !py-2 text-xs shrink-0">Scan another</button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Money in" value={inr(r.totals.inflow)} accent="text-signal-green" />
        <Stat label="Money out" value={inr(r.totals.outflow)} />
        <Stat label="Net saved" value={inr(r.totals.net)} accent={r.totals.net >= 0 ? 'text-signal-green' : 'text-signal-red'} />
        <Stat label="Savings rate" value={sr == null ? '—' : `${Math.round(sr * 100)}%`} accent={sr != null && sr >= 0.2 ? 'text-signal-green' : sr != null && sr < 0 ? 'text-signal-red' : ''} />
      </div>

      {/* Where the money went */}
      <section className="card p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-4">Where your money went</h2>
        <div className="space-y-3">
          {r.byCategory.map((c: any) => (
            <div key={c.category}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold">{c.label} {c.discretionary && <span className="text-[10px] text-ink-faint font-normal">(flexible)</span>}</span>
                <span className="tabular-nums text-ink-soft">{inr(c.total)} · {c.pct}%</span>
              </div>
              <div className="h-2 bg-paper-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${c.discretionary ? 'bg-signal-amber' : 'bg-pine-600'}`} style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Invested */}
      <section className="card p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-2">What you invested</h2>
        {r.invested.total > 0 ? (
          <>
            <p className="text-sm text-ink-soft mb-3">You put <strong>{inr(r.invested.total)}</strong> toward investments & insurance (~{inr(r.invested.monthlyAvg)}/month).</p>
            <ul className="divide-y divide-paper-100 text-sm">
              {r.invested.items.map((it: any, i: number) => (
                <li key={i} className="py-2 flex justify-between"><span className="truncate max-w-[70%]">{it.description}</span><span className="tabular-nums text-ink-soft">{inr(it.amount)}</span></li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-ink-soft">No investments or SIPs were detected in this statement. <Link href="/invest" className="text-pine-700 underline">See a starter plan →</Link></p>
        )}
      </section>

      {/* Reduce */}
      {r.reduceSuggestions.length > 0 && (
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">How to spend less</h2>
          <div className="space-y-3">
            {r.reduceSuggestions.map((s: any, i: number) => (
              <div key={i} className="rounded-xl border border-paper-200 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="max-w-xl">
                    <p className="text-sm font-bold">{s.area}</p>
                    <p className="text-xs text-ink-soft mt-1 leading-relaxed">{s.finding}</p>
                    <p className="text-xs text-pine-800 mt-1.5 leading-relaxed"><strong>Try:</strong> {s.tip}</p>
                  </div>
                  {s.potentialAnnualSaving > 0 && (
                    <div className="text-right shrink-0">
                      <p className="font-display text-lg font-semibold text-signal-green tabular-nums">{inr(s.potentialAnnualSaving)}</p>
                      <p className="text-[11px] text-ink-faint">possible / year</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Watch out + recurring */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">What to take care of</h2>
          {r.watchOuts.length === 0 && r.positives.length === 0 && <p className="text-sm text-ink-soft">Nothing major stands out — nicely managed.</p>}
          <div className="space-y-2">
            {r.watchOuts.map((w: any, i: number) => (
              <div key={i} className={`rounded-lg px-3 py-2.5 text-xs leading-relaxed ${SEV[w.severity]}`}>{w.message}</div>
            ))}
          </div>
          {r.positives.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {r.positives.map((pp: string, i: number) => (
                <li key={i} className="flex gap-2 text-xs text-signal-green leading-relaxed"><span className="font-bold shrink-0">✓</span>{pp}</li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Recurring payments</h2>
          {r.recurring.length === 0 ? <p className="text-sm text-ink-soft">No clear recurring payments found.</p> : (
            <ul className="divide-y divide-paper-100 text-sm">
              {r.recurring.map((s: any, i: number) => (
                <li key={i} className="py-2 flex justify-between gap-3">
                  <span className="truncate">{s.description} <span className="text-[11px] text-ink-faint">×{s.occurrences}</span></span>
                  <span className="tabular-nums text-ink-soft shrink-0">{inr(s.avgAmount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-[11px] text-ink-faint leading-relaxed">{r.disclaimer}</p>
    </div>
  );
}
