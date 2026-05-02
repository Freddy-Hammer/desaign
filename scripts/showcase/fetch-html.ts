const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, accept: string, retries = 2): Promise<string> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1500 * attempt);
    const res = await fetch(url, { headers: { ...BROWSER_HEADERS, Accept: accept } });
    if (res.ok) return res.text();
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`HTTP ${res.status} for ${url}`);
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  throw lastErr ?? new Error(`Failed after retries: ${url}`);
}

export function fetchHtml(url: string): Promise<string> {
  return fetchWithRetry(
    url,
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  );
}

export function fetchXml(url: string): Promise<string> {
  return fetchWithRetry(url, "application/rss+xml, application/xml, text/xml");
}

const SOCIAL_AND_AWARD_HOSTS =
  /^(?:[^/]*\.)?(?:facebook|instagram|twitter|x|youtube|youtu\.be|linkedin|tiktok|pinterest|behance|dribbble|vimeo|github|threads|bsky|mastodon|awwwards|thefwa|cssdesignawards|siteinspire|google|apple|microsoft|amazon|wikipedia|cdn|gstatic|googleapis|t\.co)\b/i;

/**
 * Given a list of external URLs found on a detail page, return the most
 * frequently linked non-social, non-award URL — that's almost always the
 * awarded site's homepage. Returns null if no candidate occurs at least twice.
 */
export function pickExternalUrl(externals: string[]): string | null {
  const counts = new Map<string, number>();
  for (const raw of externals) {
    let host: string;
    try {
      host = new URL(raw).hostname;
    } catch {
      continue;
    }
    if (SOCIAL_AND_AWARD_HOSTS.test(host)) continue;
    // Normalize: strip trailing slash, remove fragments, drop common tracking params.
    const u = new URL(raw);
    u.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"].forEach(
      (p) => u.searchParams.delete(p)
    );
    const key = u.origin + u.pathname.replace(/\/+$/, "");
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [url, count] of counts) {
    if (count > bestCount) {
      best = url;
      bestCount = count;
    }
  }
  return bestCount >= 2 ? best : best && counts.size === 1 ? best : null;
}
