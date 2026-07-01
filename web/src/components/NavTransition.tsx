'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// Lightweight global navigation feedback: a thin top progress bar that flashes
// briefly on each in-app route change. No full-screen curtain — the big
// contextual curtains are handled per-page by <LoadingScreen>, which only
// appears when that page's data actually takes a moment to load. Skips the very
// first mount (the welcome splash owns that).
export function NavTransition() {
  const path = usePathname();
  const first = useRef(true);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setShow(true);
    const t = setTimeout(() => setShow(false), 700);
    return () => clearTimeout(t);
  }, [path]);

  if (!show) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[95] h-0.5 bg-mint-500/20 no-print" aria-hidden>
      <div className="h-full bg-mint-500 pw-navbar" />
    </div>
  );
}
