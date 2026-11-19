import { MAX_CHAT_LENGTH, MAX_NAME_LENGTH, ROOM_ID_LENGTH } from '@/lib/constants';

const ROOM_ID_PATTERN = new RegExp(`^[A-Z0-9]{${ROOM_ID_LENGTH}}$`);

export function sanitizeName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

export function normalizeRoomId(raw: string): string {
  return raw
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .slice(0, ROOM_ID_LENGTH);
}

export function isValidRoomId(roomId: string): boolean {
  return ROOM_ID_PATTERN.test(roomId);
}

export function sanitizeChat(raw: string): string {
  return raw.trim().slice(0, MAX_CHAT_LENGTH);
}
