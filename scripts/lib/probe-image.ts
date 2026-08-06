/**
 * Best-effort check that a URL actually serves an image Telegram can fetch.
 *
 * Deliberately FAILS OPEN: any network error, DNS failure, TLS error or timeout
 * returns true, so a transient blip can never demote a good thumbnail or push a
 * publishable item down a lossy path. Only a definitive bad response — non-2xx,
 * non-image content-type, or a body outside Telegram's usable range — is false.
 *
 * Measures the real body length rather than trusting Content-Length: TheFWA's
 * Site-of-the-Day ribbon generator serves HTTP 200 + `image/png` + 0 bytes.
 */
const MIN_BYTES = 1024;
const MAX_BYTES = 10_000_000; // Telegram sendPhoto-by-URL ceiling

export async function probeImage(url: string, timeoutMs = 8000): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return false;
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return false;
    const bytes = (await res.arrayBuffer()).byteLength;
    return bytes >= MIN_BYTES && bytes <= MAX_BYTES;
  } catch {
    return true; // fail open
  }
}
