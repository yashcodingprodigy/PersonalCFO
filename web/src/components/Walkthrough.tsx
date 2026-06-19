'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// A guided first-run tour. Each step navigates to the relevant page, then a
// floating card explains what's on it. Rendered in the app layout so it
// survives navigation. Shows once per device (localStorage flag).
const STEPS = [
  { href: '/dashboard', emoji: '📊', title: 'Your Overview', body: 'Your Money Health Score, net worth, and your single most important move this month — all on one screen.' },
  { href: '/actions', emoji: '✅', title: 'Actions', body: 'A prioritised to-do list with exact rupee amounts. Tick one off and watch your score move.' },
  { href: '/tax', emoji: '🧾', title: 'Tax', body: 'See exactly how to cut your tax — regime choice, deductions and advance tax, all in plain English.' },
  { href: '/file', emoji: '📄', title: 'File your ITR', body: 'A guided wizard computes your whole return, then either walks you through filing it yourself or hands your CA a ready-to-file pack.' },
  { href: '/invest', emoji: '📈', title: 'Invest', body: 'A personalised plan for where to put your money, matched to your age and risk. Categories, never specific tips.' },
  { href: '/alerts', emoji: '🔔', title: 'Alerts', body: 'PayWatch keeps watching your money and pings you before deadlines, spending spikes and gaps bite.' },
  { href: '/dashboard', emoji: '🎉', title: "You're all set!", body: 'Every feature lives in the menu — the ☰ button (top-left) on mobile, the sidebar on desktop. Enjoy!' },
];

export function Walkthrough() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    // Show for a fresh signup (onboarding redirects to /dashboard?welcome=1)
    // even on a device that's been toured before; otherwise show once per device.
    let isWelcome = false;
    try { isWelcome = new URLSearchParams(window.location.search).get('welcome') === '1'; } catch {}
    let toured = false;
    try { toured = !!localStorage.getItem('paywatch_toured'); } catch {}
    if (isWelcome || !toured) {
      setVisible(true);
      // strip the ?welcome flag so a refresh doesn't re-trigger
      if (isWelcome) { try { window.history.replaceState({}, '', '/dashboard'); } catch {} }
    }
  }, []);

  function done() {
    try { localStorage.setItem('paywatch_toured', '1'); } catch {}
    setVisible(false);
    router.push('/dashboard');
  }
  function go(n: number) { setI(n); router.push(STEPS[n].href); }

  if (!visible) return null;
  const s = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] flex justify-center px-4 pb-4 no-print pointer-events-none">
      <div className="card bg-pine-950 text-white p-5 max-w-md w-full shadow-lift pointer-events-auto">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2"><span className="text-2xl">{s.emoji}</span><span className="text-[11px] uppercase tracking-wider text-mint-300 font-bold">Tour · {i + 1}/{STEPS.length}</span></div>
          <button onClick={done} className="text-xs text-white/50 underline">Skip tour</button>
        </div>
        <h2 className="font-display text-lg font-semibold mt-2">{s.title}</h2>
        <p className="text-sm text-white/75 mt-1.5 leading-relaxed">{s.body}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {STEPS.map((_, j) => <span key={j} className={`w-1.5 h-1.5 rounded-full transition-colors ${j === i ? 'bg-mint-400' : 'bg-white/20'}`} />)}
          </div>
          <div className="flex gap-2">
            {i > 0 && <button onClick={() => go(i - 1)} className="rounded-full border border-white/30 text-white px-4 py-1.5 text-sm font-semibold hover:bg-white/10">Back</button>}
            <button onClick={() => (last ? done() : go(i + 1))} className="rounded-full bg-mint-500 text-pine-950 px-5 py-1.5 text-sm font-bold hover:bg-mint-400">{last ? 'Done' : 'Next →'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
