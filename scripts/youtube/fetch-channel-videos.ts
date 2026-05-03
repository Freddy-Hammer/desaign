const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

export interface VideoDetails {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  duration: string; // ISO 8601, e.g. PT12M34S
  thumbnailUrl: string;
  viewCount: number;
}

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("Missing env var: YOUTUBE_API_KEY");
  return key;
}

async function ytGet(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${YT_API_BASE}/${path}`);
  url.searchParams.set("key", getApiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API error ${res.status}: ${body}`);
  }
  return res.json();
}

function parseHandle(channelUrl: string): string | null {
  const match = channelUrl.match(/youtube\.com\/@([\w.-]+)/);
  return match ? match[1] : null;
}

function parseChannelId(channelUrl: string): string | null {
  const match = channelUrl.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  return match ? match[1] : null;
}

async function resolveChannelId(channelUrl: string): Promise<{ channelId: string; channelTitle: string }> {
  const handle = parseHandle(channelUrl);
  if (handle) {
    const data = await ytGet("channels", { part: "snippet", forHandle: handle }) as any;
    const item = data?.items?.[0];
    if (!item) throw new Error(`Channel not found for handle: @${handle}`);
    return { channelId: item.id, channelTitle: item.snippet.title };
  }

  const channelId = parseChannelId(channelUrl);
  if (channelId) {
    const data = await ytGet("channels", { part: "snippet", id: channelId }) as any;
    const item = data?.items?.[0];
    if (!item) throw new Error(`Channel not found for ID: ${channelId}`);
    return { channelId: item.id, channelTitle: item.snippet.title };
  }

  throw new Error(`Cannot parse channel URL: ${channelUrl}`);
}

/** Parses ISO 8601 duration (e.g. PT1M30S) into total seconds. */
function parseDurationSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? "0", 10) * 3600) +
         (parseInt(m[2] ?? "0", 10) * 60) +
         parseInt(m[3] ?? "0", 10);
}

/**
 * Detects Shorts by GETting /shorts/{id} and reading the canonical URL.
 * Real Shorts keep the /shorts/ path; regular videos canonicalize to /watch?v=...
 * Only called for videos whose duration is ambiguous (≤ 60s).
 */
async function isShort(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/shorts/${videoId}`, {
      headers: { "user-agent": "Mozilla/5.0" },
    });
    const html = await res.text();
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    return canonical?.includes("/shorts/") ?? false;
  } catch {
    return false;
  }
}

/**
 * Fetches recent videos from a channel URL within the freshness window.
 * Excludes Shorts using YouTube's /shorts/{id} URL classification.
 */
export async function fetchChannelVideos(
  channelUrl: string,
  publishedAfter: Date
): Promise<{ videos: VideoDetails[]; shortsSkipped: number }> {
  const { channelId, channelTitle } = await resolveChannelId(channelUrl);

  // Step 1: search for recent videos
  const searchData = await ytGet("search", {
    part: "snippet",
    channelId,
    type: "video",
    order: "date",
    publishedAfter: publishedAfter.toISOString(),
    maxResults: "50",
  }) as any;

  const searchItems: any[] = searchData?.items ?? [];
  if (searchItems.length === 0) return { videos: [], shortsSkipped: 0 };

  const videoIds = searchItems.map((item: any) => item.id.videoId as string).join(",");

  // Step 2: fetch contentDetails (duration) + statistics (viewCount) in one call
  const detailData = await ytGet("videos", {
    part: "snippet,contentDetails,statistics",
    id: videoIds,
  }) as any;

  const detailItems: any[] = detailData?.items ?? [];

  let shortsSkipped = 0;
  const videos: VideoDetails[] = [];

  // Primary gate: duration > 60s → definitely not a short, no HTTP check needed.
  // Only scrape the /shorts/ URL for videos ≤ 60s (rare edge cases like very
  // short regular clips or ambiguous new Shorts formats).
  const shortFlags = await Promise.all(
    detailItems.map((item) => {
      const secs = parseDurationSeconds(item.contentDetails?.duration ?? "");
      if (secs > 60) return Promise.resolve(false);
      return isShort(item.id as string);
    })
  );

  for (let i = 0; i < detailItems.length; i++) {
    const item = detailItems[i];
    if (shortFlags[i]) {
      shortsSkipped++;
      continue;
    }

    const vid = item.id as string;
    videos.push({
      videoId: vid,
      title: item.snippet.title,
      description: item.snippet.description ?? "",
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle ?? channelTitle,
      publishedAt: item.snippet.publishedAt,
      duration: item.contentDetails?.duration ?? "",
      thumbnailUrl: `https://img.youtube.com/vi/${vid}/maxresdefault.jpg`,
      viewCount: parseInt(item.statistics?.viewCount ?? "0", 10),
    });
  }

  return { videos, shortsSkipped };
}
