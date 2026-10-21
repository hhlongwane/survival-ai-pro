const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  bucketKey: string,
  maxRequests = 90,
  windowMs = 60_000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = buckets.get(bucketKey);
  if (!entry || now >= entry.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(bucketKey, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }
  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export function getClientKey(req: Request, routeName: string): string {
  const forwarded = req.headers.get("x-forwarded-for") || "127.0.0.1";
  return `${routeName}:${forwarded.split(",")[0].trim()}`;
}

export function sanitizeSymbol(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase().slice(0, 16);
}

export function sanitizeText(raw: unknown, maxLen = 160): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[<>]/g, "").trim().slice(0, maxLen);
}
