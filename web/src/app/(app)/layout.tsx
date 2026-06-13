'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Wordmark } from '@/components/Logo';
import { get, clearTokens, getTokens, del } from '@/lib/api';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: 'M3 13h7V3H3v10Zm0 8h7v-6H3v6Zm11 0h7V11h-7v10Zm0-18v6h7V3h-7Z' },
  { href: '/actions', label: 'Actions', icon: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z' },
  { href: '/networth', label: 'Net worth', icon: 'M4 19h16v2H4v-2Zm2-4 4-6 4 3 5-7 1.5 1.2L15 14l-4-3-3.5 5H6Z' },
  { href: '/invest', label: 'Invest', icon: 'M3 13h2v7H3v-7Zm4-4h2v11H7V9Zm4-5h2v16h-2V4Zm4 8h2v8h-2v-8Z' },
  { href: '/tax', label: 'Tax', icon: 'M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Zm-1 14-4-4 1.4-1.4L11 13.2l5.6-5.6L18 9l-7 7Z' },
  { href: '/insurance', label: 'Insurance', icon: 'M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z' },
  { href: '/statement', label: 'Statement scan', icon: 'M6 2h9l5 5v15H6V2Zm8 1.5V8h4.5L14 3.5ZM8 11h8v2H8v-2Zm0 4h8v2H8v-2Z' },
  { href: '/goals', label: 'Goals', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 16a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0-9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z' },
  { href: '/ask', label: 'Ask your CFO', icon: 'M4 4h16v12H7l-3 3V4Zm4 5h8v2H8V9Z' },
  { href: '/reports', label: 'Reports', icon: 'M6 2h9l5 5v15H6V2Zm8 1.5V8h4.5L14 3.5ZM8 12h8v2H8v-2Zm0 4h8v2H8v-2Z' },
  { href: '/settings', label: 'Settings', icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 4a7.8 7.8 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-2-1.2L16 3h-4l-.4 2.6a8 8 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5a8 8 0 0 0 0 2.4l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 2 1.2L8 21h4l.4-2.6a8 8 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.2-.8.2-1.2Z' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (!getTokens().access) { router.replace('/login'); return; }
    get('/user/me').then(setUser).catch(() => {});
  }, [router]);

  async function logout() {
    try { await del('/auth/logout'); } catch {}
    clearTokens();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-60 flex-col bg-pine-950 text-white fixed inset-y-0 no-print">
        <div className="px-5 py-6"><Link href="/dashboard"><Wordmark dark size="sm" /></Link></div>
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                ${path?.startsWith(n.href) ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={n.icon} /></svg>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          {user && (
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{user.name || user.mobile}</p>
                <p className="text-[11px] text-mint-300 uppercase tracking-wider font-bold">{user.plan} plan</p>
              </div>
              <button onClick={logout} className="text-white/50 hover:text-white text-xs underline">Sign out</button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-20 bg-pine-950 text-white px-4 py-3 flex items-center justify-between no-print">
        <Link href="/dashboard"><Wordmark dark size="sm" /></Link>
        <button onClick={logout} className="text-xs text-white/60 underline">Sign out</button>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-paper-200 grid grid-cols-5 no-print">
        {NAV.slice(0, 5).map((n) => (
          <Link key={n.href} href={n.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${path?.startsWith(n.href) ? 'text-pine-800' : 'text-ink-faint'}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={n.icon} /></svg>
            {n.label.split(' ')[0]}
          </Link>
        ))}
      </nav>

      <main className="flex-1 md:ml-60 px-4 sm:px-8 pt-16 md:pt-8 pb-24 md:pb-12 max-w-6xl">{children}</main>
    </div>
  );
}
