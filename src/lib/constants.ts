export const BOARD_SIZE = 30;
export const BOARD_CELL_SIZE = 28;
export const WIN_LENGTH = 5;
export const MAX_PLAYERS = 2;

/** How long a disconnected player's seat is kept before they are removed from the room. */
export const RECONNECT_GRACE_MS = 60_000;

/** Room data in Redis expires after this many seconds without activity. */
export const ROOM_TTL_SECONDS = 60 * 60 * 6;

export const MAX_CHAT_HISTORY = 100;
export const MAX_CHAT_LENGTH = 500;
export const MAX_NAME_LENGTH = 20;
export const ROOM_ID_LENGTH = 6;
