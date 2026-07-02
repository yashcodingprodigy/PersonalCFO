'use client';

import Link from 'next/link';
import { useState } from 'react';

// A short, plain-English needs-discovery quiz. Education only — it points out
// the TYPES of cover you may want, never a specific product or "best plan".
type Answer = 'yes' | 'no' | null;

interface Q {
  key: string;
  q: string;
  suggestWhen: Answer;   // answer that indicates a possible gap
  cover: string;         // marketplace category key
  label: string;
  why: string;
}

const QUESTIONS: Q[] = [
  { key: 'dependents', q: 'Does anyone rely on your income — family, kids or parents?', suggestWhen: 'yes',
    cover: 'term_life', label: 'Term life cover', why: 'Replaces your income for the people who depend on you if something happens to you.' },
  { key: 'ownhealth', q: 'Do you have your own health insurance (not just from your employer)?', suggestWhen: 'no',
    cover: 'health', label: 'Health cover', why: 'Employer cover ends with the job. Your own policy stays with you and pays hospital bills.' },
  { key: 'vehicle', q: 'Do you own a car or bike?', suggestWhen: 'yes',
    cover: 'motor', label: 'Motor insurance', why: 'It’s legally required and covers damage, theft and third-party claims.' },
  { key: 'earner', q: 'Would an accident that stopped you working hurt your family financially?', suggestWhen: 'yes',
    cover: 'personal_accident', label: 'Personal accident cover', why: 'Pays out if an accident stops you earning — inexpensive and often missed.' },
];

export function NeedsCheck() {
  const [ans, setAns] = useState<Record<string, Answer>>({});
  const answered = QUESTIONS.filter((q) => ans[q.key]).length;
  const done = answered === QUESTIONS.length;
  const needs = QUESTIONS.filter((q) => ans[q.key] === q.suggestWhen);

  function reset() { setAns({}); }

  return (
    <div className="card p-6">
      <div className="space-y-4">
        {QUESTIONS.map((q, i) => (
          <div key={q.key} className="flex items-start justify-between gap-4 flex-wrap">
            <p className="text-sm text-ink flex-1 min-w-[200px]"><span className="text-ink-faint font-semibold mr-1.5">{i + 1}.</span>{q.q}</p>
            <div className="inline-flex rounded-full bg-paper-100 p-1 shrink-0">
              {(['yes', 'no'] as const).map((v) => (
                <button key={v} onClick={() => setAns((a) => ({ ...a, [q.key]: v }))}
                  className={`rounded-full px-4 py-1 text-xs font-bold capitalize transition-colors ${ans[q.key] === v ? 'bg-pine-900 text-white' : 'text-ink-soft hover:text-ink'}`}>{v}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {done && (
        <div className="mt-6 pt-5 border-t border-paper-100 pw-fade-up">
          {needs.length > 0 ? (
            <>
              <p className="text-sm font-bold text-pine-900">Based on your answers, you may want to look at:</p>
              <div className="mt-3 space-y-2.5">
                {needs.map((n) => (
                  <div key={n.key} className="rounded-xl bg-paper-50 border border-paper-200 p-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-pine-900">{n.label}</p>
                      <p className="text-xs text-ink-soft mt-0.5 leading-relaxed">{n.why}</p>
                    </div>
                    <Link href={`/insurance/market?category=${n.cover}`} className="shrink-0 rounded-full bg-pine-900 text-white px-4 py-2 text-xs font-bold hover:bg-pine-800 transition-colors">See plans →</Link>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-pine-800 font-semibold">Looks like your basics are covered — nice. Keep your policies up to date and revisit if your life changes.</p>
          )}
          <button onClick={reset} className="mt-4 text-xs text-ink-faint underline">Start over</button>
          <p className="mt-3 text-[11px] text-ink-faint leading-relaxed">General guidance to help you decide what to explore — not insurance advice. Cover amounts and terms depend on the insurer.</p>
        </div>
      )}
      {!done && <p className="mt-4 text-xs text-ink-faint">Answer all {QUESTIONS.length} to see what cover may suit you.</p>}
    </div>
  );
}
