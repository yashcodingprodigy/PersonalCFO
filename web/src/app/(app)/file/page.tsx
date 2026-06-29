'use client';

import Link from 'next/link';
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

      {/* Two paths: hand to a CA, or file it yourself with a guide */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Link href="/advisor" className="card p-5 hover:border-pine-600 hover:shadow-card transition-all">
          <p className="text-2xl">🤝</p>
          <p className="text-sm font-bold mt-1">Hand it to your CA</p>
          <p className="text-xs text-ink-faint mt-0.5">Gather the docs below and send them to your CA in a tap.</p>
        </Link>
        <Link href="/file/self" className="card p-5 border-pine-600/40 bg-mint-50 hover:shadow-card transition-all">
          <p className="text-2xl">🧭</p>
          <p className="text-sm font-bold mt-1">File it yourself →</p>
          <p className="text-xs text-ink-faint mt-0.5">A simple, step-by-step guide to file your own ITR on the government portal.</p>
        </Link>
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
