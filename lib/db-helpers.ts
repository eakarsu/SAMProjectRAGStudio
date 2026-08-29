import { ensureDatabase, getD1 } from '@/db/bootstrap';

export type SqlValue = string | number | null | ArrayBuffer;

export async function all<T>(sql: string, values: SqlValue[] = []): Promise<T[]> {
  await ensureDatabase();
  const result = await getD1().prepare(sql).bind(...values).all<T>();
  return result.results ?? [];
}

export async function first<T>(sql: string, values: SqlValue[] = []): Promise<T | null> {
  await ensureDatabase();
  return getD1().prepare(sql).bind(...values).first<T>();
}

export async function run(sql: string, values: SqlValue[] = []) {
  await ensureDatabase();
  return getD1().prepare(sql).bind(...values).run();
}

export async function batch(statements: Array<{ sql: string; values?: SqlValue[] }>) {
  await ensureDatabase();
  if (statements.length === 0) return [];
  return getD1().batch(
    statements.map(({ sql, values = [] }) => getD1().prepare(sql).bind(...values)),
  );
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function sha256(value: string | ArrayBuffer | Uint8Array): Promise<string> {
  const input = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : value instanceof Uint8Array
      ? value
      : new Uint8Array(value);
  const digestInput = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', digestInput);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
