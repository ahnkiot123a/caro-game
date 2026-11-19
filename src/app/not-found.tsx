import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-6xl font-black text-slate-700">404</p>
      <p className="text-slate-400">This page or room does not exist.</p>
      <Link
        href="/"
        className="rounded-xl bg-indigo-500 px-4 py-2 font-semibold text-white transition hover:bg-indigo-400"
      >
        Back to home
      </Link>
    </div>
  );
}
