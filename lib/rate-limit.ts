const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const LIMIT = Number(process.env.AUTH_RATE_LIMIT ?? 120);

/** Simple fixed-window in-memory limiter for auth endpoints. Returns true when the request is allowed. */
export function allowRequest(request: Request, scope: string): boolean {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= LIMIT;
}
