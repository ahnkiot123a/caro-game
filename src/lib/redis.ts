import { Redis } from '@upstash/redis';

let client: Redis | null | undefined;

/**
 * Returns a singleton Upstash Redis client, or null when the Upstash
 * credentials are not configured (local development without Redis).
 */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  client = url && token ? new Redis({ url, token }) : null;
  return client;
}
