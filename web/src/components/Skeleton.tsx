'use client';

import { useEffect, useState } from 'react';

// ── Shimmer skeleton ────────────────────────────────────────────────
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`pw-skeleton rounded-lg ${className}`} />;
}

// A card-shaped skeleton that roughly matches our content blocks.
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="w-11 h-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => <Skeleton key={i} className={`h-3 ${i % 2 ? 'w-4/5' : 'w-full'}`} />)}
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3, lines = 2 }: { count?: number; lines?: number }) {
  return <div className="space-y-3">{Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} lines={lines} />)}</div>;
}

// Drop-in page loading state: a header skeleton + a few card skeletons.
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-5 mt-1">
      <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-3 w-72 max-w-full" /></div>
      <SkeletonList count={cards} lines={2} />
    </div>
  );
}

// ── Witty loader (animated gauge + rotating messages) ───────────────
const DEFAULT_MESSAGES = [
  'crunching the numbers…',
  'reading the fine print so you don’t have to…',
  'doing math you’d rather avoid…',
  'pretending this takes effort…',
];

function Gauge({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="6" />
      <path d="M50 8 a42 42 0 0 1 40 42" fill="none" stroke="#2FBC9B" strokeWidth="6" strokeLinecap="round" className="pw-spin" style={{ transformOrigin: '50px 50px' }} />
      <g className="pw-sweep">
        <line x1="50" y1="50" x2="50" y2="20" stroke="#2FBC9B" strokeWidth="3.5" strokeLinecap="round" />
      </g>
      <circle cx="50" cy="50" r="5" fill="#2FBC9B" />
    </svg>
  );
}

// Full-section loader with rotating sarcastic copy. `dark` for on-brand dark bg.
export function WittyLoader({ messages = DEFAULT_MESSAGES, title, dark = false, className = '' }: { messages?: string[]; title?: string; dark?: boolean; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % messages.length), 1600);
    return () => clearInterval(t);
  }, [messages.length]);
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 ${dark ? 'text-white' : 'text-pine-900'} ${className}`}>
      {title && <p className="font-display text-2xl font-medium mb-6 max-w-xs">{title}</p>}
      <Gauge />
      <p key={i} className={`pw-fade-up text-sm mt-5 ${dark ? 'text-white/70' : 'text-ink-soft'}`}>{messages[i]}</p>
    </div>
  );
}

// A compact inline spinner + message (for buttons / small waits).
export function InlineLoader({ label = 'loading…' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
      <svg width="16" height="16" viewBox="0 0 24 24" className="pw-spin" aria-hidden>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <path d="M12 3 a9 9 0 0 1 9 9" fill="none" stroke="#2FBC9B" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}
