'use client';

import { useEffect, useState } from 'react';

/** Seconds remaining until `deadline` (epoch ms), updated every second. */
export function useCountdown(deadline: number | null): number {
  const compute = () => (deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0);
  const [remaining, setRemaining] = useState(compute);

  useEffect(() => {
    setRemaining(compute());
    if (!deadline) return;
    const timer = setInterval(() => setRemaining(compute()), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline]);

  return remaining;
}
