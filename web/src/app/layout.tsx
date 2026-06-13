import type { Metadata, Viewport } from 'next';
// Self-hosted fonts (Fontsource) — no Google Fonts request at build or
// runtime, which also keeps the app free of third-party font tracking.
import '@fontsource-variable/manrope';
import '@fontsource-variable/fraunces';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'PayWatch — Know exactly what to do with your money', template: '%s · PayWatch' },
  description:
    "India's personal finance operating system. One app that knows your full financial picture — and tells you exactly what to do next. Financial education and organisation, not SEBI investment advice.",
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'PayWatch' },
};

export const viewport: Viewport = {
  themeColor: '#0B2F2A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}
