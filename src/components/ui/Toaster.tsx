'use client';

import { useEffect } from 'react';
import { useGameStore, type Toast } from '@/store/gameStore';
import { cn } from '@/utils/format';

const tones: Record<Toast['tone'], string> = {
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-100',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useGameStore((s) => s.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);

  return (
    <button
      type="button"
      onClick={() => dismiss(toast.id)}
      className={cn(
        'animate-slide-in pointer-events-auto w-full cursor-pointer rounded-xl border px-4 py-3 text-left text-sm shadow-lg backdrop-blur',
        tones[toast.tone],
      )}
    >
      {toast.message}
    </button>
  );
}

export function Toaster() {
  const toasts = useGameStore((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-4 right-4 left-4 z-50 ml-auto flex max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
