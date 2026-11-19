import { z } from 'zod';
import { BOARD_SIZE, MAX_CHAT_LENGTH, MAX_NAME_LENGTH } from '@/lib/constants';
import { isValidRoomId, normalizeRoomId, sanitizeChat, sanitizeName } from '@/utils/validation';

const name = z
  .string()
  .transform(sanitizeName)
  .pipe(z.string().min(1, 'Nickname is required.').max(MAX_NAME_LENGTH));

const token = z.string().min(16).max(128);

const roomId = z.string().transform(normalizeRoomId).refine(isValidRoomId, 'Invalid room ID.');

const coordinate = z
  .number()
  .int()
  .min(0)
  .max(BOARD_SIZE - 1);

export const createRoomSchema = z.object({ name, token });

export const joinRoomSchema = z.object({ roomId, name, token });

export const moveSchema = z.object({ roomId, row: coordinate, col: coordinate });

export const chatSchema = z.object({
  roomId,
  content: z
    .string()
    .transform(sanitizeChat)
    .pipe(z.string().min(1, 'Message is empty.').max(MAX_CHAT_LENGTH)),
});

export const roomScopedSchema = z.object({ roomId });
