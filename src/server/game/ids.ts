import { randomBytes } from 'node:crypto';
import { ROOM_ID_LENGTH } from '@/lib/constants';

// Unambiguous alphabet (no 0/O, 1/I/L) so room codes are easy to read aloud.
const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRoomId(length: number = ROOM_ID_LENGTH): string {
  const bytes = randomBytes(length);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  }
  return id;
}

export function generateId(): string {
  return randomBytes(12).toString('base64url');
}
