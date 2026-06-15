'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get, patch, post, del } from '@/lib/api';
import { UpgradeBanner } from '@/components/UpgradeBanner';

const SEV: Record<string, { dot: string; label: string; ring: string }> = {
  urgent: { dot: 'bg-signal-red', label: 'Urgent', ring: 'border-l-signal-red' },
  warning: { dot: 'bg-signal-amber', label: 'Worth a look', ring: 'border-l-signal-amber' },
  info: { dot: 'bg-pine-600', label: 'FYI', ring: 'border-l-pine-600' },
  good: { dot: 'bg-signal-green', label: 'Win', ring: 'border-l-signal-green' },
};

export default function AlertsPage() {
  const [data, setData] = useState<any>(null);

  async function load() { setData(await get('/alerts')); }
  useEffect(() => { load().catch(() => {}); }, []);

  async function markRead(id: string) {
    await patch(`/alerts/${id}/read`, {});
    setData((d: any) => ({ ...d, alerts: d.alerts.map((a: any) => (a.id === id ? { ...a, status: 'read' } : a)) }));
  }
  async function dismiss(id: string) {
    await del(`/alerts/${id}`);
    setData((d: any) => ({ ...d, alerts: d.alerts.filter((a: any) => a.id !== id) }));
  }
  async function readAll() {
    await post('/alerts/read-all');
    setData((d: any) => ({ ...d, alerts: d.alerts.map((a: any) => ({ ...a, status: 'read' })) }));
  }

  if (!data) return <div className="card h-96 animate-pulse mt-4" />;

  const alerts = data.alerts || [];
  const unread = alerts.filter((a: any) => a.status === 'unread').length;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">Alerts</h1>
          <p className="text-sm text-ink-soft mt-1">PayWatch keeps an eye on your money and pings you when something needs action.</p>
        </div>
        {unread > 0 && <button onClick={readAll} className="btn-secondary !py-2 text-xs">Mark all read</button>}
      </div>

      <UpgradeBanner feature="Proactive alerts and the monthly email briefing" />

      {alerts.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-3xl mb-2">✓</p>
          <p className="text-sm text-ink-soft">All clear — nothing needs your attention right now. We&apos;ll let you know the moment something does.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((a: any) => {
            const sev = SEV[a.severity] || SEV.info;
            return (
              <article key={a.id} className={`card p-5 border-l-4 ${sev.ring} ${a.status === 'read' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`mt-1.5 inline-block w-2 h-2 rounded-full shrink-0 ${sev.dot}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-bold">{a.title}</h2>
                        {a.status === 'unread' && <span className="chip bg-mint-100 text-pine-800">new</span>}
                      </div>
                      <p className="text-xs text-ink-soft mt-1 leading-relaxed">{a.body}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <span className="chip bg-paper-100 text-ink-soft capitalize">{a.category}</span>
                        {a.due_date && <span className="chip bg-signal-amber/10 text-signal-amber">by {new Date(a.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                        {a.action_href && <Link href={a.action_href} onClick={() => markRead(a.id)} className="text-xs font-semibold text-pine-700 hover:underline">{a.action_label || 'Open'} →</Link>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {a.status === 'unread' && <button onClick={() => markRead(a.id)} className="text-[11px] text-ink-faint underline">mark read</button>}
                    <button onClick={() => dismiss(a.id)} className="text-ink-faint hover:text-ink" aria-label="Dismiss"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" /></svg></button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-ink-faint leading-relaxed">Alerts are educational reminders based on your data and published planning standards — not investment, tax or legal advice.</p>
    </div>
  );
}
