'use client';

import { useEffect, useState } from 'react';

// A short first-run tour. Shows once per device (localStorage flag), with
// Next / Skip. Render it on the dashboard — new users land there after onboarding.
const STEPS = [
  { emoji: '👋', title: 'Welcome to PayWatch', body: "Your whole money picture in one place — and a clear plan for what to do next. Here's a 30-second tour." },
  { emoji: '📊', title: 'Your Money Health Score', body: 'The Overview shows your score across six areas of financial health, your net worth, and your single most important move this month.' },
  { emoji: '✅', title: 'Actions', body: 'A prioritised to-do list with exact rupee amounts. Tick one off and your score updates — that\'s how you improve.' },
  { emoji: '🧾', title: 'Tax & File ITR', body: 'See exactly how to cut your tax, then file your return yourself with a guided, step-by-step wizard — no CA needed for most people.' },
  { emoji: '📈', title: 'Invest', body: 'A personalised plan for where to put your money — fund categories matched to your age and risk, never specific tips.' },
  { emoji: '🔔', title: 'PayWatch watches for you', body: 'Alerts flag tax deadlines, spending spikes and gaps before they bite. Every feature lives in the ☰ menu (top-left on mobile). Enjoy!' },
];

export function Walkthrough() {
  const [visible, setVisible] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    try { if (!localStorage.getItem('paywatch_toured')) setVisible(true); } catch {}
  }, []);

  function done() {
    try { localStorage.setItem('paywatch_toured', '1'); } catch {}
    setVisible(false);
  }

  if (!visible) return null;
  const s = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4 bg-pine-950/70 no-print">
      <div className="card bg-white p-6 max-w-sm w-full">
        <div className="flex justify-between items-start">
          <div className="text-3xl">{s.emoji}</div>
          <button onClick={done} className="text-xs text-ink-faint underline">Skip tour</button>
        </div>
        <h2 className="font-display text-xl font-semibold mt-3">{s.title}</h2>
        <p className="text-sm text-ink-soft mt-2 leading-relaxed">{s.body}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {STEPS.map((_, j) => <span key={j} className={`w-1.5 h-1.5 rounded-full transition-colors ${j === i ? 'bg-pine-700' : 'bg-paper-200'}`} />)}
          </div>
          <div className="flex gap-2">
            {i > 0 && <button onClick={() => setI(i - 1)} className="btn-secondary !py-2 !px-4 text-sm">Back</button>}
            <button onClick={() => (last ? done() : setI(i + 1))} className="btn-primary !py-2 !px-5 text-sm">{last ? 'Get started' : 'Next'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
