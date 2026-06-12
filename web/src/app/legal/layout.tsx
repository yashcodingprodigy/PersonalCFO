import Link from 'next/link';
import { Wordmark } from '@/components/Logo';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link href="/"><Wordmark size="sm" /></Link>
        <Link href="/login" className="text-sm font-semibold text-pine-700 hover:underline">Sign in</Link>
      </header>
      <main className="max-w-3xl mx-auto px-6 pb-20 prose-sm">
        <article className="card p-8 sm:p-10 [&>h1]:font-display [&>h1]:text-3xl [&>h1]:font-medium [&>h2]:font-bold [&>h2]:text-base [&>h2]:mt-8 [&>h2]:mb-2 [&>p]:text-sm [&>p]:text-ink-soft [&>p]:leading-relaxed [&>p]:mb-3 [&>ul]:text-sm [&>ul]:text-ink-soft [&>ul]:leading-relaxed [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3">
          {children}
        </article>
      </main>
    </div>
  );
}
