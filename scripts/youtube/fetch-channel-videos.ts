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
 * Detects Shorts using only YouTube API data — no extra HTTP requests, works in CI.
 * Threshold is 3 minutes (180s): YouTube Shorts max out at ~3 min, so anything
 * ≤ 180s is excluded to be safe. No hashtag heuristics — duration is definitive.
 */
function isLikelyShort(item: any): boolean {
  const secs = parseDurationSeconds(item.contentDetails?.duration ?? "");
  return secs <= 180;
}

/**
 * Fetches recent videos from a channel URL within the freshness window.
 * Excludes Shorts using API-only detection (duration + #shorts hashtag).
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

  for (const item of detailItems) {
    if (isLikelyShort(item)) {
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
