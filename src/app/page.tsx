import { HomeForm } from '@/components/home/HomeForm';

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 py-10 lg:flex-row lg:gap-16">
      <section className="max-w-md text-center lg:text-left">
        <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
          Five in a row.
          <br />
          <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-rose-400 bg-clip-text text-transparent">
            Play live with friends.
          </span>
        </h1>
        <p className="mt-4 text-slate-400">
          Create a room, share the 6-character code and play Caro (Gomoku) on a 30×30 board in
          realtime. Chat, rematch and reconnect seamlessly.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-3 text-sm text-slate-300">
          {['Realtime moves', 'In-room chat', 'Auto reconnect', 'Rematch voting'].map((f) => (
            <li
              key={f}
              className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 transition hover:border-indigo-500/50"
            >
              {f}
            </li>
          ))}
        </ul>
      </section>
      <HomeForm />
    </div>
  );
}
