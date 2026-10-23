'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getTokens } from '@/lib/api';

// On the public landing page: if the user already has a session (common when
// the native app cold-starts back to its first screen), send them into the app.
export function AuthRedirect() {
  const router = useRouter();
  useEffect(() => {
    // Logo clicks from inside the app land here with ?home=1 — let them see the home page.
    const wantsHome = new URLSearchParams(window.location.search).has('home');
    if (getTokens().access && !wantsHome) router.replace('/dashboard');
  }, [router]);
  return null;
}
