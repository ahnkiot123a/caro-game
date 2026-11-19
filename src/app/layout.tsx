import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Toaster } from '@/components/ui/Toaster';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Caro Online', template: '%s · Caro Online' },
  description: 'Play Caro (Gomoku) online with friends in realtime.',
};

export const viewport: Viewport = {
  themeColor: '#020617',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Browser extensions often inject attributes into <html>/<body> before hydration.
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="flex flex-col font-sans" suppressHydrationWarning>
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-black tracking-tight">
            <span className="text-sky-400">✕</span>
            <span className="text-rose-400">◯</span>
            <span className="text-white">Caro Online</span>
          </Link>
          <span className="hidden text-xs text-slate-500 sm:block">30×30 · Five in a row</span>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-3 pb-8 sm:px-4">
          {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
