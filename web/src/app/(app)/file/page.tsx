'use client';

import { ItrDocPrep } from '@/components/ItrDocPrep';

export default function FilePage() {
  const d = new Date();
  const startY = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  const fy = `${startY}-${String(startY + 1).slice(2)}`;

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-medium">Prepare your ITR docs</h1>
        <p className="text-sm text-ink-soft mt-1">Get everything you need to file your taxes in one place — gather each document below, store it safely (encrypted), and send it to your CA in a tap. FY {fy}.</p>
      </div>

      {/* Documents to prepare — upload, store & send to your CA */}
      <div className="card p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-1">📋 Documents to prepare</h2>
        <p className="text-xs text-ink-soft mb-3">Tap <strong>+</strong> on any document to upload it (encrypted) or send it to your CA. Sent items tick off automatically in your shared checklist.</p>
        <ItrDocPrep />
      </div>
    </div>
  );
}
