import { createHash } from 'crypto';
import { getJson, setJson, getVersion, bumpVersion } from './cacheClient';
import { logger } from '../utils/logger';


const TTL_SECONDS = 300;


function fingerprint(input: unknown): string {
  const canonicalJson = JSON.stringify(canonicalize(input ?? {}));

  return createHash('sha1')
    .update(canonicalJson)
    .digest('hex')
    .slice(0, 16);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (isPlainObject(value)) {
    const sortedEntries = Object.entries(value)
      .filter(([, propertyValue]) => propertyValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, propertyValue]) => [key, canonicalize(propertyValue)]);

    return Object.fromEntries(sortedEntries);
  }

  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function cached<T>(
  entity: string,
  operation: string,
  params: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  const version = await getVersion(entity);
  const key = `${entity}:v${version}:${operation}:${fingerprint(params)}`;

  const hit = await getJson<T>(key); //So it there is a cache miss, the server reads from the sql and populates the data again right?
  if (hit !== null) return hit;

  const fresh = await fn();
  await setJson(key, fresh, TTL_SECONDS);
  return fresh;
}


export async function invalidate(
  entity: string,
  warm: Array<() => Promise<unknown>> = [],
): Promise<void> {
  await bumpVersion(entity);

  for (const w of warm) {
    w().catch(err => logger.warn({ err, entity }, 'Cache warm failed'));
  }
}
