'use client';

// A small guide pinned to the corner of the page the assistant opened:
// "what to do" and "what to avoid", personalised from the user's own numbers.
// Collapsible, dismissible, and it stays put while the user browses.

import { useState } from 'react';
import { useLang } from '@/lib/i18n';

export interface Guide { page: string; title: string; intro?: string; doThis: string[]; avoid: string[]; footnote?: string }

export function GuidePanel({ guide, onClose, onAsk }: { guide: Guide; onClose: () => void; onAsk: () => void }) {
  const { t } = useLang();
  const [min, setMin] = useState(false);
  return (
    <div className="fixed z-[60] right-3 md:right-6 bottom-36 md:bottom-28 w-[calc(100vw-1.5rem)] max-w-[360px] no-print pw-pop-in" role="complementary" aria-label={guide.title}>
      <div className="rounded-3xl bg-white shadow-lift border border-mint-500/30 overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 pw-voice-bg text-white">
          <span className="w-7 h-7 rounded-full pw-orb-mini shrink-0" />
          <p className="font-bold text-sm flex-1 leading-snug">{guide.title}</p>
          <button onClick={() => setMin(!min)} aria-label={min ? t('gd.expand') : t('gd.collapse')} className="w-7 h-7 rounded-full hover:bg-white/15 grid place-items-center text-white/80">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ transform: min ? 'rotate(180deg)' : undefined }}><path d="M7 14l5-5 5 5H7Z" /></svg>
          </button>
          <button onClick={onClose} aria-label={t('as.close')} className="w-7 h-7 rounded-full hover:bg-white/15 grid place-items-center text-white/80">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" /></svg>
          </button>
        </div>
        {!min && (
          <div className="px-4 py-3.5 max-h-[52vh] overflow-y-auto text-sm">
            {guide.intro && <p className="text-ink-soft mb-2.5">{guide.intro}</p>}
            <p className="text-[11px] font-bold uppercase tracking-wider text-pine-700">{t('gd.do')}</p>
            <ul className="mt-1.5 space-y-1.5">
              {guide.doThis.map((x) => <li key={x} className="flex gap-2 leading-snug"><span className="text-mint-500 font-bold shrink-0">✓</span><span>{x}</span></li>)}
            </ul>
            {guide.avoid.length > 0 && <>
              <p className="mt-3.5 text-[11px] font-bold uppercase tracking-wider text-signal-red">{t('gd.avoid')}</p>
              <ul className="mt-1.5 space-y-1.5">
                {guide.avoid.map((x) => <li key={x} className="flex gap-2 leading-snug"><span className="text-signal-red font-bold shrink-0">✕</span><span>{x}</span></li>)}
              </ul>
            </>}
            {guide.footnote && <p className="mt-3 text-[10px] text-ink-faint leading-relaxed">{guide.footnote}</p>}
            <button onClick={onAsk} className="mt-3 text-xs font-bold text-pine-700 hover:text-pine-900">{t('gd.ask')} →</button>
          </div>
        )}
      </div>
    </div>
  );
}
