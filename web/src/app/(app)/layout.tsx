'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Wordmark } from '@/components/Logo';
import { get, post, swr, clearTokens, getTokens, del } from '@/lib/api';
import { isNative, initNative, unlock, registerPush } from '@/lib/native';
import { Walkthrough } from '@/components/Walkthrough';

const ASK_ICON = 'M4 4h16v12H7l-3 3V4Zm4 5h8v2H8V9Z';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: 'M3 13h7V3H3v10Zm0 8h7v-6H3v6Zm11 0h7V11h-7v10Zm0-18v6h7V3h-7Z' },
  { href: '/ask', label: 'Ask PayWatch', icon: ASK_ICON, accent: true },
  { href: '/alerts', label: 'Alerts', icon: 'M12 2a6 6 0 0 0-6 6v3.6L4 14v2h16v-2l-2-2.4V8a6 6 0 0 0-6-6Zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3Z' },
  { href: '/actions', label: 'Actions', icon: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z' },
  { href: '/goals', label: 'Goals', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 16a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0-9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z' },
  { href: '/networth', label: 'Net worth', icon: 'M4 19h16v2H4v-2Zm2-4 4-6 4 3 5-7 1.5 1.2L15 14l-4-3-3.5 5H6Z' },
  { href: '/invest', label: 'Invest', icon: 'M3 13h2v7H3v-7Zm4-4h2v11H7V9Zm4-5h2v16h-2V4Zm4 8h2v8h-2v-8Z' },
  { href: '/markets', label: 'Markets & news', icon: 'M3 3v18h18v-2H5V3H3Zm4 11 3-3 3 3 5-5-1.4-1.4L15 11l-3-3-4 4 1 1Z' },
  { href: '/tax', label: 'Tax', icon: 'M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Zm-1 14-4-4 1.4-1.4L11 13.2l5.6-5.6L18 9l-7 7Z' },
  { href: '/file', label: 'File ITR', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 2 4 4h-4V4ZM9 13l2 2 4-4 1.4 1.4L11 17.8 7.6 14.4 9 13Z' },
  { href: '/insurance', label: 'Insurance', icon: 'M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z' },
  { href: '/statement', label: 'Statement scan', icon: 'M6 2h9l5 5v15H6V2Zm8 1.5V8h4.5L14 3.5ZM8 11h8v2H8v-2Zm0 4h8v2H8v-2Z' },
  { href: '/vault', label: 'Document vault', icon: 'M3 5h6l2 2h10v12H3V5Zm2 2v10h14V9h-8.8l-2-2H5Z' },
  { href: '/reports', label: 'Reports', icon: 'M6 2h9l5 5v15H6V2Zm8 1.5V8h4.5L14 3.5ZM8 12h8v2H8v-2Zm0 4h8v2H8v-2Z' },
  { href: '/settings', label: 'Settings', icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 4a7.8 7.8 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-2-1.2L16 3h-4l-.4 2.6a8 8 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5a8 8 0 0 0 0 2.4l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 2 1.2L8 21h4l.4-2.6a8 8 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.2-.8.2-1.2Z' },
];

// Mobile bottom bar — Ask your CFO sits in the centre as the hero action.
const BOTTOM = ['/dashboard', '/actions', '/ask', '/invest'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  const [locked, setLocked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!getTokens().access) { router.replace('/login'); return; }
    // Cached + revalidated so the shell doesn't flicker on every navigation.
    swr('/user/me', setUser, 30_000).catch(() => {});
    swr('/alerts/count', (r: any) => setUnread(r.unread || 0), 10_000).catch(() => {});
  }, [router, path]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMenuOpen(false); }, [path]);
  const isPaid = user && (user.plan === 'cfo' || user.plan === 'family') && user.plan_status === 'active';
  const bottomItems = BOTTOM.map((href) => NAV.find((n) => n.href === href)!);

  // Native app: biometric app-lock + push registration (no-ops on web)
  useEffect(() => {
    if (!isNative()) return;
    setLocked(true);
    initNative(() => setLocked(true));
    // Push needs Firebase (google-services.json / APNs) set up first, or it
    // crashes the app. Stays off until NEXT_PUBLIC_PUSH_ENABLED=1 at build time.
    if (process.env.NEXT_PUBLIC_PUSH_ENABLED === '1') {
      registerPush((token, platform) => { post('/user/push-token', { token, platform }).catch(() => {}); });
    }
    unlock().then((ok) => { if (ok) setLocked(false); });
  }, []);

  async function logout() {
    try { await del('/auth/logout'); } catch {}
    clearTokens();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen flex">
      {/* Biometric lock screen (native only) */}
      {locked && (
        <div className="fixed inset-0 z-[100] bg-pine-950 text-white flex flex-col items-center justify-center gap-6 px-6">
          <Wordmark dark size="lg" />
          <p className="text-sm text-white/70">Locked for your security</p>
          <button onClick={() => unlock().then((ok) => ok && setLocked(false))}
            className="rounded-full bg-mint-500 text-pine-950 px-8 py-3 text-sm font-bold hover:bg-mint-400 transition-colors">
            Unlock
          </button>
        </div>
      )}

      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-60 flex-col bg-pine-950 text-white fixed inset-y-0 no-print">
        <div className="px-5 py-6"><Link href="/dashboard"><Wordmark dark size="sm" plus={!!isPaid} /></Link></div>
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                ${path?.startsWith(n.href)
                  ? ((n as any).accent ? 'bg-mint-500 text-pine-950' : 'bg-white/10 text-white')
                  : ((n as any).accent ? 'bg-mint-500/15 text-mint-200 ring-1 ring-mint-500/40 hover:bg-mint-500/25' : 'text-white/60 hover:text-white hover:bg-white/5')}`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={n.icon} /></svg>
              <span className="flex-1">{n.label}</span>
              {(n as any).accent && <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">AI</span>}
              {n.href === '/alerts' && unread > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-mint-500 text-pine-950 text-[10px] font-bold">{unread}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-3">
          {user && !((user.plan === 'cfo' || user.plan === 'family') && user.plan_status === 'active') && (
            <Link href="/plans" className="block rounded-lg bg-mint-500 text-pine-950 text-center text-xs font-bold py-2 hover:bg-mint-400 transition-colors">
              ✦ Upgrade to PayWatch Plus
            </Link>
          )}
          {user && (
            <div className="flex items-center justify-between">
              <Link href="/plans" className="min-w-0">
                <p className="text-sm font-semibold truncate">{user.name || user.mobile}</p>
                <p className="text-[11px] text-mint-300 uppercase tracking-wider font-bold">{user.plan} plan ›</p>
              </Link>
              <button onClick={logout} className="text-white/50 hover:text-white text-xs underline">Sign out</button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-20 bg-pine-950 text-white px-3 py-3 flex items-center justify-between no-print">
        <button onClick={() => setMenuOpen(true)} aria-label="Menu" className="p-1.5 -ml-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h18v2H3v-2Z" /></svg>
        </button>
        <Link href="/dashboard"><Wordmark dark size="sm" plus={!!isPaid} /></Link>
        <Link href="/alerts" aria-label="Alerts" className="relative p-1.5 -mr-1">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a6 6 0 0 0-6 6v3.6L4 14v2h16v-2l-2-2.4V8a6 6 0 0 0-6-6Zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3Z" /></svg>
          {unread > 0 && <span className="absolute top-0 right-0 min-w-[16px] h-[16px] px-0.5 rounded-full bg-mint-500 text-pine-950 text-[9px] font-bold flex items-center justify-center">{unread}</span>}
        </Link>
      </header>

      {/* Mobile drawer — every feature */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40 no-print">
          <div className="absolute inset-0 bg-pine-950/60" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[82%] bg-pine-950 text-white flex flex-col shadow-lift">
            <div className="px-5 py-5 flex items-center justify-between border-b border-white/10">
              <Wordmark dark size="sm" plus={!!isPaid} />
              <button onClick={() => setMenuOpen(false)} aria-label="Close" className="text-white/60 p-1"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" /></svg></button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                    ${path?.startsWith(n.href)
                      ? ((n as any).accent ? 'bg-mint-500 text-pine-950' : 'bg-white/10 text-white')
                      : ((n as any).accent ? 'bg-mint-500/15 text-mint-200 ring-1 ring-mint-500/40 hover:bg-mint-500/25' : 'text-white/70 hover:text-white hover:bg-white/5')}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={n.icon} /></svg>
                  <span className="flex-1">{n.label}</span>
                  {(n as any).accent && <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">AI</span>}
                  {n.href === '/alerts' && unread > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-mint-500 text-pine-950 text-[10px] font-bold">{unread}</span>
                  )}
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-white/10 space-y-3">
              {user && !isPaid && (
                <Link href="/plans" className="block rounded-lg bg-mint-500 text-pine-950 text-center text-xs font-bold py-2">✦ Upgrade to PayWatch Plus</Link>
              )}
              {user && (
                <div className="flex items-center justify-between">
                  <Link href="/plans" className="min-w-0"><p className="text-sm font-semibold truncate">{user.name || user.mobile}</p><p className="text-[11px] text-mint-300 uppercase tracking-wider font-bold">{user.plan} plan ›</p></Link>
                  <button onClick={logout} className="text-white/50 text-xs underline">Sign out</button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Mobile bottom nav — Ask your CFO is the raised centre action */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-paper-200 grid grid-cols-5 no-print">
        {bottomItems.map((n) =>
          (n as any).accent ? (
            <Link key={n.href} href={n.href} className="flex flex-col items-center justify-end -mt-4">
              <span className={`flex items-center justify-center w-12 h-12 rounded-full shadow-lift border-4 border-white ${path?.startsWith(n.href) ? 'bg-pine-900 text-white' : 'bg-mint-500 text-pine-950'}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={n.icon} /></svg>
              </span>
              <span className={`text-[10px] font-bold mt-0.5 ${path?.startsWith(n.href) ? 'text-pine-800' : 'text-pine-700'}`}>Ask</span>
            </Link>
          ) : (
            <Link key={n.href} href={n.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${path?.startsWith(n.href) ? 'text-pine-800' : 'text-ink-faint'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={n.icon} /></svg>
              {n.label.split(' ')[0]}
            </Link>
          )
        )}
        <button onClick={() => setMenuOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold text-ink-faint">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" /></svg>
          More
        </button>
      </nav>

      <main className="flex-1 md:ml-60 px-4 sm:px-8 pt-16 md:pt-8 pb-24 md:pb-12 max-w-6xl">{children}</main>

      {/* Floating "Ask PayWatch" button — ask in context from any page */}
      {!locked && !path?.startsWith('/ask') && (
        <Link href="/ask" aria-label="Ask PayWatch"
          className="fixed z-30 right-4 bottom-20 md:right-6 md:bottom-6 no-print flex items-center gap-2 rounded-full bg-mint-500 text-pine-950 shadow-lift px-4 py-3 text-sm font-bold hover:bg-mint-400 transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={ASK_ICON} /></svg>
          <span className="hidden sm:inline">Ask PayWatch</span>
        </Link>
      )}

      {/* Guided first-run tour (persists across navigation) */}
      {!locked && <Walkthrough />}
    </div>
  );
}
