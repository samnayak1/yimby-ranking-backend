import Redis from 'ioredis';
import { logger } from '../utils/logger';



const REDIS_URL = 'redis://redis:6379';

const COMMAND_TIMEOUT_MS = 200;

let redis: Redis | null = null;
let warnedUnavailable = false;

if (process.env.CACHE_ENABLED !== 'false') {
  redis = new Redis(REDIS_URL, {
    lazyConnect: false,
    commandTimeout: COMMAND_TIMEOUT_MS, // dont queue commands
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: times => Math.min(times * 500, 10_000),
  });

  redis.on('error', err => {
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      logger.warn({ err: err.message }, 'Redis unavailable — serving from SQLite');
    }
  });

  redis.on('ready', () => {
    warnedUnavailable = false;
    logger.info('Redis connected');
  });
}

export const cacheEnabled = (): boolean => redis?.status === 'ready';

async function safe<T>(op: () => Promise<T>, fallback: T): Promise<T> {
  if (!cacheEnabled()) return fallback;
  try {
    return await op();
  } catch {
    return fallback;
  }
}

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await safe(() => redis!.get(key), null);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;  
  }
}

export async function setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  await safe(() => redis!.set(key, JSON.stringify(value), 'EX', ttlSeconds), 'skipped' as unknown as 'OK');
}


export async function getVersion(entity: string): Promise<number> {
  const v = await safe(() => redis!.get(`v:${entity}`), null);
  return v ? Number(v) : 0;
}

export async function bumpVersion(entity: string): Promise<void> {
  await safe(() => redis!.incr(`v:${entity}`), 0);
}

export async function quitCache(): Promise<void> {
  if (!redis) return;
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}
