const timers = new Map<string, NodeJS.Timeout>();

const keyOf = (roomId: string, playerId: string) => `${roomId}:${playerId}`;

export function scheduleDisconnectTimeout(
  roomId: string,
  playerId: string,
  delayMs: number,
  onExpire: () => void,
): void {
  cancelDisconnectTimeout(roomId, playerId);
  const key = keyOf(roomId, playerId);
  const timer = setTimeout(() => {
    timers.delete(key);
    onExpire();
  }, delayMs);
  timer.unref?.();
  timers.set(key, timer);
}

export function cancelDisconnectTimeout(roomId: string, playerId: string): void {
  const key = keyOf(roomId, playerId);
  const timer = timers.get(key);
  if (timer) {
    clearTimeout(timer);
    timers.delete(key);
  }
}
