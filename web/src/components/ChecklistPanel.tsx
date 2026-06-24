'use client';

import { useState } from 'react';

export interface ItrDoc { key: string; name: string; who: string; how: string }
type State = Record<string, { sent?: boolean; received?: boolean }>;

// Shared ITR document checklist used on both the CA and user sides. The current
// side toggles its own field (CA → "received", user → "sent"); the other side's
// status is shown read-only and updates live.
export function ChecklistPanel({ role, documents, state, onToggle }: {
  role: 'ca' | 'user';
  documents: ItrDoc[];
  state: State;
  onToggle: (key: string, field: 'sent' | 'received', value: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const received = documents.filter((d) => state[d.key]?.received).length;
  const shown = expanded ? documents : documents.slice(0, 3);
  return (
    <div className="card p-6">
      <button onClick={() => setExpanded((e) => !e)} className="w-full flex items-center justify-between gap-2 flex-wrap text-left">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">ITR document checklist</h2>
        <span className="text-xs text-ink-faint">{received}/{documents.length} received · {expanded ? 'hide' : 'show all'} ▾</span>
      </button>
      <ul className="divide-y divide-paper-100 mt-3">
        {shown.map((d) => {
          const st = state[d.key] || {};
          const mine = role === 'ca' ? !!st.received : !!st.sent;
          return (
            <li key={d.key} className="py-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={mine} onChange={() => onToggle(d.key, role === 'ca' ? 'received' : 'sent', !mine)} className="mt-1 accent-mint-500 w-4 h-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{d.name} <span className="text-[10px] text-ink-faint font-normal">· from {d.who}</span></p>
                  <p className="text-xs text-ink-faint leading-relaxed">{d.how}</p>
                  <div className="mt-1 flex gap-3 text-[10px]">
                    <span className={st.sent ? 'text-signal-green font-bold' : 'text-ink-faint'}>{st.sent ? '✓ client sent' : '○ not sent'}</span>
                    <span className={st.received ? 'text-signal-green font-bold' : 'text-ink-faint'}>{st.received ? '✓ CA received' : '○ CA awaiting'}</span>
                  </div>
                </div>
              </label>
            </li>
          );
        })}
      </ul>
      {!expanded && documents.length > shown.length && (
        <button onClick={() => setExpanded(true)} className="mt-2 text-xs text-pine-700 font-semibold hover:underline">Show all {documents.length} documents ▾</button>
      )}
      <p className="text-[10px] text-ink-faint mt-2">{role === 'ca' ? 'Tick documents as you receive them — the client sees it live.' : 'Tick documents you’ve shared — your CA confirms receipt.'}</p>
    </div>
  );
}
