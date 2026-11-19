const NICKNAME_KEY = 'caro:nickname';
const TOKEN_KEY = 'caro:player-token';

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Secret token identifying this browser tab as a player. Stored in sessionStorage so
 * it survives page reloads (reconnect restores the seat) while separate tabs act as
 * separate players.
 */
export function getPlayerToken(): string {
  let token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = randomToken();
    sessionStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export function getStoredNickname(): string {
  return localStorage.getItem(NICKNAME_KEY) ?? '';
}

export function storeNickname(name: string): void {
  localStorage.setItem(NICKNAME_KEY, name);
}
