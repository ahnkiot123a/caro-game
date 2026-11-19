/**
 * Per-key async mutex. Serializes read-modify-write cycles on a room inside one
 * process so concurrent socket events (e.g. a move and a disconnect) can't
 * overwrite each other's changes.
 */
const tails = new Map<string, Promise<unknown>>();

export async function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(task);
  const tail = run.catch(() => undefined);
  tails.set(key, tail);

  try {
    return await run;
  } finally {
    if (tails.get(key) === tail) tails.delete(key);
  }
}
