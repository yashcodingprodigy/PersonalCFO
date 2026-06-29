'use client';

import { useEffect, useState } from 'react';

// Listens for global toast events and renders an auto-dismissing stack.
export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  useEffect(() => {
    const onToast = (e: Event) => {
      const msg = (e as CustomEvent).detail as string;
      const id = Date.now() + Math.random();
      setItems((p) => [...p, { id, msg }]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 3500);
    };
    window.addEventListener('pw:toast', onToast);
    return () => window.removeEventListener('pw:toast', onToast);
  }, []);
  if (!items.length) return null;
  return (
    <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[60] flex flex-col gap-2 no-print max-w-[90vw]">
      {items.map((it) => (
        <div key={it.id} className="rounded-xl bg-pine-900 text-white text-sm font-semibold px-4 py-3 shadow-lift flex items-center gap-2">
          <span className="text-mint-300 shrink-0">✓</span>{it.msg}
        </div>
      ))}
    </div>
  );
}
