import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils/format';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-11 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 text-slate-100 transition outline-none placeholder:text-slate-500',
          'hover:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30',
          className,
        )}
        {...props}
      />
    );
  },
);
