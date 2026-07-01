'use client';

import { useEffect, useRef, useState } from 'react';
import { Wordmark } from '@/components/Logo';

// Shows a centred "Hello, {name}" once per app-open, then lifts away to reveal
// the page underneath. Guarded by sessionStorage so it only plays on a fresh
// launch (new tab / native app open), not on every in-app navigation.
const KEY = 'paywatch_greeted';

function greetWord(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Hello';
}

export function WelcomeSplash({ name }: { name?: string }) {
  const [active, setActive] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || typeof window === 'undefined') return;
    if (sessionStorage.getItem(KEY)) return; // already greeted this app-open
    sessionStorage.setItem(KEY, '1');
    started.current = true;
    setActive(true);
    const t1 = setTimeout(() => setLeaving(true), 1950); // begin lift-off
    const t2 = setTimeout(() => setActive(false), 2550); // unmount after transition
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!active) return null;
  const first = (name || '').trim().split(/\s+/)[0] || 'there';

  return (
    <div
      className={`pw-splash fixed inset-0 z-[120] flex flex-col items-center justify-center gap-7 bg-pine-950 text-white no-print ${leaving ? 'pw-splash-leave' : ''}`}
      aria-hidden
    >
      {/* Animated gauge — the ring draws in, the needle sweeps */}
      <svg width="120" height="120" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#ffffff" strokeOpacity="0.10" strokeWidth="5" />
        <circle
          cx="50" cy="50" r="45" fill="none" stroke="#2FBC9B" strokeWidth="5" strokeLinecap="round"
          strokeDasharray="283" transform="rotate(-90 50 50)" className="pw-ring-draw"
        />
        <g className="pw-sweep">
          <line x1="50" y1="50" x2="50" y2="18" stroke="#2FBC9B" strokeWidth="3.5" strokeLinecap="round" />
        </g>
        <circle cx="50" cy="50" r="5" fill="#2FBC9B" />
      </svg>

      <div className="pw-greet-in text-center px-6">
        <p className="text-sm uppercase tracking-[0.2em] text-mint-300 font-bold">{greetWord()}</p>
        <h1 className="font-display text-4xl sm:text-5xl font-medium mt-2">
          Hello, <span className="text-mint-300">{first}</span>
        </h1>
        <p className="text-sm text-white/50 mt-3">Getting your money picture ready…</p>
      </div>

      <div className="absolute bottom-10 pw-greet-in" style={{ animationDelay: '0.2s' }}>
        <Wordmark dark size="sm" />
      </div>
    </div>
  );
}
