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
  const [duplicates, setDuplicates] = useState(0);
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
      setReport(res.report); setImported(res.imported || 0); setDuplicates(res.duplicates || 0); setStage('done');
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
        <Report report={report} imported={imported} duplicates={duplicates} onReset={reset} />
      )}
    </div>
  );
}

function Stat({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className={`font-display text-2xl font-semibold mt-1 tabular-nums ${accent || ''}`}>{value}</p>
      {sub && <p className="text-[11px] text-ink-faint mt-0.5">{sub}</p>}
    </div>
  );
}

const PALETTE = ['#1f6f54', '#e0a23b', '#3b82a6', '#a3577d', '#6b8e3b', '#b5654a', '#9aa0a6'];

// Dependency-free SVG donut.
function Donut({ segments, size = 184, thickness = 28 }: { segments: { label: string; value: number; color: string }[]; size?: number; thickness?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0ee" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const dash = (s.value / total) * c;
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset} strokeLinecap="butt" />;
          offset += dash;
          return el;
        })}
      </g>
    </svg>
  );
}

function Report({ report: r, imported, duplicates, onReset }: { report: any; imported: number; duplicates: number; onReset: () => void }) {
  const sr = r.totals.savingsRate;
  const fmtD = (s: string) => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const out = r.totals.outflow || 1;
  const top = r.byCategory.slice(0, 6);
  const restTotal = r.byCategory.slice(6).reduce((s: number, c: any) => s + c.total, 0);
  const segments = [
    ...top.map((c: any, i: number) => ({ label: c.label, value: c.total, color: PALETTE[i], pct: c.pct })),
    ...(restTotal > 0 ? [{ label: 'Other', value: restTotal, color: PALETTE[6], pct: Math.round((restTotal / out) * 100) }] : []),
  ];
  const split = r.split || { discretionary: 0, essential: 0, investments: 0 };
  const sp = (v: number) => Math.round((v / out) * 100);

  return (
    <div className="space-y-6">
      {/* Header: period + summary */}
      <div className="card p-5 border-l-4 border-l-mint-500 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-pine-700 mb-1">
            {r.period?.from ? `${fmtD(r.period.from)} – ${fmtD(r.period.to)} · ${r.period.months} month${r.period.months === 1 ? '' : 's'}` : 'Your statement'}
          </p>
          <p className="text-sm text-ink-soft leading-relaxed">{r.summary}</p>
          {imported > 0 && <p className="text-xs text-signal-green mt-2">{imported} new transaction{imported === 1 ? '' : 's'} saved — your Money Health Score has been updated.</p>}
          {duplicates > 0 && <p className="text-xs text-ink-faint mt-1">{duplicates} duplicate{duplicates === 1 ? '' : 's'} skipped (already imported).</p>}
        </div>
        <button onClick={onReset} className="btn-secondary !py-2 text-xs shrink-0">Scan another</button>
      </div>

      {/* KPI row with monthly context */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Money in" value={inr(r.totals.inflow)} accent="text-signal-green" sub={`~${inr(r.monthly.avgInflow)}/mo`} />
        <Stat label="Money out" value={inr(r.totals.outflow)} sub={`~${inr(r.monthly.avgOutflow)}/mo`} />
        <Stat label="Net saved" value={inr(r.totals.net)} accent={r.totals.net >= 0 ? 'text-signal-green' : 'text-signal-red'} sub={r.totals.net >= 0 ? 'kept' : 'overspent'} />
        <Stat label="Savings rate" value={sr == null ? '—' : `${Math.round(sr * 100)}%`} accent={sr != null && sr >= 0.2 ? 'text-signal-green' : sr != null && sr < 0 ? 'text-signal-red' : ''} sub="target 20%+" />
      </div>

      {/* Headline: where you could've saved */}
      {r.potentialAnnualSavings > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-pine-950 to-pine-900 text-white p-6 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-mint-300">Where you could’ve saved</p>
            <p className="text-sm text-white/75 mt-1 max-w-md">Trimming the flexible spending below — without touching essentials — could free up roughly this much a year.</p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-semibold text-mint-300">{inr(r.potentialAnnualSavings)}</p>
            <p className="text-[11px] text-white/60">potential / year</p>
          </div>
        </div>
      )}

      {/* Spending breakdown: donut + legend */}
      <section className="card p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-4">Where your money went</h2>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative shrink-0">
            <Donut segments={segments} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[10px] uppercase tracking-wider text-ink-faint">Spent</p>
              <p className="font-display text-xl font-semibold">{inr(r.totals.outflow)}</p>
            </div>
          </div>
          <ul className="flex-1 w-full space-y-1.5">
            {segments.map((s: any, i: number) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
                <span className="flex-1 truncate">{s.label}</span>
                <span className="tabular-nums text-ink-soft">{inr(s.value)}</span>
                <span className="tabular-nums text-ink-faint w-10 text-right">{s.pct}%</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Flexible vs fixed vs invested split */}
        <div className="mt-6">
          <div className="flex h-3 rounded-full overflow-hidden">
            <div className="bg-signal-amber" style={{ width: `${sp(split.discretionary)}%` }} title="Flexible" />
            <div className="bg-pine-600" style={{ width: `${sp(split.essential)}%` }} title="Essentials" />
            <div className="bg-mint-500" style={{ width: `${sp(split.investments)}%` }} title="Invested" />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[11px]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-signal-amber" /> Flexible {sp(split.discretionary)}% · {inr(split.discretionary)}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-pine-600" /> Essentials {sp(split.essential)}% · {inr(split.essential)}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-mint-500" /> Invested {sp(split.investments)}% · {inr(split.investments)}</span>
          </div>
        </div>
      </section>

      {/* Top merchants + largest expenses */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Top merchants</h2>
          {r.topMerchants?.length ? (
            <ul className="divide-y divide-paper-100 text-sm">
              {r.topMerchants.map((m: any, i: number) => (
                <li key={i} className="py-2 flex justify-between gap-3">
                  <span className="truncate">{m.description} <span className="text-[11px] text-ink-faint">×{m.count} · {m.category}</span></span>
                  <span className="tabular-nums text-ink-soft shrink-0">{inr(m.total)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-soft">No clear merchant spending found.</p>}
        </section>
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Largest single expenses</h2>
          {r.largestExpenses?.length ? (
            <ul className="divide-y divide-paper-100 text-sm">
              {r.largestExpenses.map((e: any, i: number) => (
                <li key={i} className="py-2 flex justify-between gap-3">
                  <span className="truncate">{e.description} <span className="text-[11px] text-ink-faint">{fmtD(e.date)} · {e.category}</span></span>
                  <span className="tabular-nums text-ink-soft shrink-0">{inr(e.amount)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-soft">—</p>}
        </section>
      </div>

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
