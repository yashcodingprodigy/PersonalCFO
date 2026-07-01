'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { quipsForPath } from '@/lib/quips';

// Global route-transition curtain: on every in-app navigation it briefly
// covers the content area with an animated gauge + a context-aware sarcastic
// caption for wherever the user is heading, then eases away to reveal the new
// page. Sits beside the sidebar (desktop) / below the top bar (mobile) so nav
// stays visible. Skips the very first mount — the welcome splash owns that.
const MIN_SHOW_MS = 480;

export function NavTransition() {
  const path = usePathname();
  const first = useRef(true);
  const [active, setActive] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [quips, setQuips] = useState<string[]>([]);
  const [qi, setQi] = useState(0);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const q = quipsForPath(path);
    setQuips(q);
    setQi(Math.floor(Math.random() * q.length));
    setActive(true);
    setLeaving(false);
    const t = setTimeout(() => setLeaving(true), MIN_SHOW_MS);
    return () => clearTimeout(t);
  }, [path]);

  // Rotate the caption if the transition lingers on a slow page.
  useEffect(() => {
    if (!active || leaving || quips.length < 2) return;
    const t = setInterval(() => setQi((x) => (x + 1) % quips.length), 1500);
    return () => clearInterval(t);
  }, [active, leaving, quips.length]);

  // Safety net so the curtain always clears (reduced-motion has no transitionend).
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setActive(false), 700);
    return () => clearTimeout(t);
  }, [leaving]);

  if (!active) return null;

  return (
    <>
      {/* Thin top progress bar for instant feedback */}
      <div className="fixed top-0 inset-x-0 z-[95] h-0.5 bg-mint-500/30 no-print" aria-hidden>
        <div className="h-full bg-mint-500 pw-navbar" />
      </div>

      {/* Contextual curtain over the content area */}
      <div
        className={`pw-splash fixed z-[90] inset-0 md:left-60 top-14 md:top-0 bg-paper flex flex-col items-center justify-center gap-8 text-center no-print ${leaving ? 'pw-splash-leave' : ''}`}
        onTransitionEnd={() => { if (leaving) setActive(false); }}
        aria-hidden
      >
        <svg width="80" height="80" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#0F3D34" strokeOpacity="0.10" strokeWidth="5" />
          <circle cx="50" cy="50" r="45" fill="none" stroke="#2FBC9B" strokeWidth="5" strokeLinecap="round"
            strokeDasharray="283" transform="rotate(-90 50 50)" className="pw-ring-draw" />
          <g className="pw-sweep"><line x1="50" y1="50" x2="50" y2="18" stroke="#2FBC9B" strokeWidth="3.5" strokeLinecap="round" /></g>
          <circle cx="50" cy="50" r="5" fill="#2FBC9B" />
        </svg>
        <p key={qi} className="pw-fade-up font-display text-3xl sm:text-4xl font-medium text-pine-900 max-w-xl px-6 leading-snug">
          {quips[qi]}
        </p>
      </div>
    </>
  );
}
