import { Card } from '@/components/ui/Card';

export default function AiGameLoading() {
  return (
    <Card
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-md items-center gap-3 p-6 text-slate-300 sm:p-8"
    >
      <span className="size-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
      Opening game…
    </Card>
  );
}
