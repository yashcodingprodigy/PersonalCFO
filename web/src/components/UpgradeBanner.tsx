'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api';

// Soft, non-blocking upsell. Renders only for users who aren't on an active
// paid plan. Content stays usable underneath — this just nudges to upgrade.
export function UpgradeBanner({ feature }: { feature?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    get('/user/me').then((u) => {
      const paid = (u.plan === 'cfo' || u.plan === 'family') && u.plan_status === 'active';
      setShow(!paid);
    }).catch(() => {});
  }, []);

  if (!show) return null;
  return (
    <div className="card p-4 bg-pine-950 text-white flex items-center justify-between gap-4 flex-wrap">
      <p className="text-sm leading-relaxed">
        <span className="font-semibold text-mint-300">PayWatch Plus</span> — {feature || 'proactive alerts, the year-round tax copilot, document vault and more'} are part of the subscription that keeps watching your money for you.
      </p>
      <Link href="/plans" className="rounded-full bg-mint-500 text-pine-950 px-5 py-2 text-sm font-bold hover:bg-mint-400 transition-colors whitespace-nowrap shrink-0">See plans</Link>
    </div>
  );
}
