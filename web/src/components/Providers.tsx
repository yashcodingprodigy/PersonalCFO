'use client';

import { LanguageProvider } from '@/lib/i18n';

// Client-side providers for the whole app (root layout is a server component).
export function Providers({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
