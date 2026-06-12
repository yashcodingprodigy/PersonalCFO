'use client';

import { useEffect, useState } from 'react';
import { bandColor, scoreBand } from '@/lib/format';

export function ScoreGauge({ score, size = 220 }: { score: number; size?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setDisplay(Math.round(score * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const color = bandColor[scoreBand(score)];
  const r = 84;
  const cx = 100, cy = 100;
  // 270° arc from 135° to 405°
  const startAngle = 135, sweep = 270;
  const polar = (angle: number) => ({
    x: cx + r * Math.cos((angle * Math.PI) / 180),
    y: cy + r * Math.sin((angle * Math.PI) / 180),
  });
  const arc = (from: number, to: number) => {
    const s = polar(from), e = polar(to);
    const large = to - from > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };
  const valueAngle = startAngle + (sweep * display) / 100;

  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`Money Health Score ${score} out of 100`}>
        <path d={arc(startAngle, startAngle + sweep)} stroke="#E7E2D6" strokeWidth="14" fill="none" strokeLinecap="round" />
        {display > 0 && (
          <path d={arc(startAngle, valueAngle)} stroke={color} strokeWidth="14" fill="none" strokeLinecap="round" />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-6xl font-semibold tabular-nums" style={{ color }}>
          {display}
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint mt-1">Money Health</div>
      </div>
    </div>
  );
}

export function DimensionBar({ label, score, explanation }: { label: string; score: number; explanation: string }) {
  const color = bandColor[scoreBand(score)];
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{score}</span>
      </div>
      <div className="h-2 rounded-full bg-paper-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
      <p className="text-xs text-ink-soft mt-1.5 leading-relaxed">{explanation}</p>
    </div>
  );
}
