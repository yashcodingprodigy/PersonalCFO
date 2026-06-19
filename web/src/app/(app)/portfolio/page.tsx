'use client';

import { useState } from 'react';
import { post } from '@/lib/api';
import { inr } from '@/lib/format';
import { parseHoldingsFile } from '@/lib/statementParse';
import { Donut, Dot, Section, Pill, C } from '@/components/kit';

const CLASS_COLOR: Record<string, string> = {
  equity: C.pine700, debt: C.mint500, gold: C.amber, international: C.pine500, cash: C.mint300, other: C.inkFaint,
};
const SECTOR_COLORS = [C.pine700, C.mint500, C.amber, C.pine500, C.mint300, C.red, '#7C6FF0', '#3BA1C9', '#C97E3B', '#9CB04A'];
const GRADE_COLOR: Record<string, string> = { A: 'text-signal-green', B: 'text-pine-700', C: 'text-signal-amber', D: 'text-signal-red' };
const SEV: Record<string, string> = { high: 'red', medium: 'amber', low: 'gray' };

export default function PortfolioPage() {
  const [stage, setStage] = useState<'idle' | 'parsing' | 'analyzing' | 'done'>('idle');
  const [a, setA] = useState<any>(null);
  const [err, setErr] = useState('');
  const [warning, setWarning] = useState('');
  const [fileName, setFileName] = useState('');

  async function handleFile(file: File) {
    setErr(''); setWarning(''); setA(null); setFileName(file.name); setStage('parsing');
    try {
      const { holdings, warning } = await parseHoldingsFile(file);
      if (!holdings.length) { setWarning(warning || 'No holdings found in that file.'); setStage('idle'); return; }
      setStage('analyzing');
      const res = await post('/holdings/analyze', { holdings });
      setA(res); setStage('done');
    } catch (e: any) { setErr(e.message); setStage('idle'); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium">Portfolio X-ray</h1>
        <p className="text-sm text-ink-soft mt-1">Upload your holdings report and see how truly diversified you are — across asset classes, market caps and sectors. Education, not advice.</p>
      </div>

      {/* Upload */}
      {stage !== 'done' && (
        <div className="card p-8 text-center">
          <label className="block cursor-pointer">
            <input type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <div className="border-2 border-dashed border-paper-200 rounded-2xl py-10 px-4 hover:border-pine-600 transition-colors">
              <p className="font-display text-lg font-medium">{stage === 'parsing' ? 'Reading your file…' : stage === 'analyzing' ? 'Analysing your portfolio…' : 'Upload your holdings (CSV / Excel)'}</p>
              <p className="text-xs text-ink-faint mt-2">Export from your broker (Zerodha Console, Groww, etc.), mutual-fund app, or a CDSL/NSDL holdings statement. Read on this device — your file isn’t stored.</p>
            </div>
          </label>
          {fileName && stage !== 'idle' && <p className="text-xs text-ink-faint mt-3">{fileName}</p>}
          {warning && <p className="text-sm text-signal-amber mt-4">{warning}</p>}
          {err && <p className="text-sm text-signal-red mt-4">{err}</p>}
        </div>
      )}

      {stage === 'done' && a && (
        <>
          {/* Score */}
          <div className="card p-6 bg-pine-950 text-white flex items-center gap-6 flex-wrap">
            <div className="text-center">
              <p className={`font-display text-5xl font-semibold ${GRADE_COLOR[a.grade]}`}>{a.grade}</p>
              <p className="text-[11px] uppercase tracking-widest text-white/50 mt-1">Diversification</p>
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm text-white/85 leading-relaxed">{a.summary}</p>
              <p className="text-xs text-white/50 mt-2">{a.count} holdings · total value {inr(a.total)} · score {a.score}/100</p>
            </div>
            <button onClick={() => { setStage('idle'); setA(null); setFileName(''); }} className="text-xs text-white/60 underline">Upload another</button>
          </div>

          {/* Asset class split */}
          <Section id="class" title="Across asset classes" hint="The first and biggest layer of diversification.">
            <div className="card p-6 flex flex-col sm:flex-row items-center gap-6">
              <Donut data={a.byAssetClass.map((c: any) => ({ label: c.label, value: c.value, color: CLASS_COLOR[c.key] || C.inkFaint }))} size={172}>
                <p className="text-[10px] uppercase tracking-wider text-ink-faint">Classes</p>
                <p className="font-display text-2xl font-semibold">{a.byAssetClass.length}</p>
              </Donut>
              <ul className="flex-1 w-full space-y-2.5">
                {a.byAssetClass.map((c: any) => (
                  <li key={c.key}>
                    <div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-2"><Dot color={CLASS_COLOR[c.key] || C.inkFaint} />{c.label}</span><span className="font-semibold tabular-nums">{c.pct}% · {inr(c.value)}</span></div>
                    <div className="h-2 bg-paper-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: CLASS_COLOR[c.key] || C.inkFaint }} /></div>
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          {/* Equity by cap */}
          {a.equityByCap.length > 0 && (
            <Section id="cap" title="Inside your equity" hint="Large / mid / small-cap spread — and how much is direct stocks.">
              <div className="card p-6 space-y-2.5">
                {a.equityByCap.map((c: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1"><span>{c.label}</span><span className="font-semibold tabular-nums">{c.pct}%</span></div>
                    <div className="h-2 bg-paper-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-pine-700" style={{ width: `${c.pct}%` }} /></div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Sector concentration (direct stocks) */}
          {a.bySector.length > 0 && (
            <Section id="sector" title="Your direct stocks by sector" hint="Are you accidentally over-betting on one industry?">
              <div className="card p-6 space-y-2.5">
                {a.bySector.map((s: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-2"><Dot color={SECTOR_COLORS[i % SECTOR_COLORS.length]} />{s.sector}</span><span className="font-semibold tabular-nums">{s.pct}%</span></div>
                    <div className="h-2 bg-paper-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} /></div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Top holdings */}
          <Section id="top" title="Your biggest holdings">
            <div className="card p-2">
              <ul className="divide-y divide-paper-100">
                {a.topHoldings.map((h: any, i: number) => (
                  <li key={i} className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm">{h.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{h.pct}% · {inr(h.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          {/* Flags */}
          {a.flags.length > 0 && (
            <Section id="flags" title="What to look at">
              <div className="space-y-2.5">
                {a.flags.map((f: any, i: number) => (
                  <div key={i} className="card p-4 flex items-start gap-3">
                    <Pill tone={SEV[f.severity] as any}>{f.severity}</Pill>
                    <p className="text-sm text-ink-soft leading-relaxed flex-1">{f.message}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <p className="text-[11px] text-ink-faint leading-relaxed">Classifications are best-effort from your holdings’ names and may not be perfect. This is educational analysis of diversification — not a recommendation to buy or sell anything.</p>
        </>
      )}
    </div>
  );
}
