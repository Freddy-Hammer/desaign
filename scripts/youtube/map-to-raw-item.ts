import { RawItem } from "../lib/raw-item-schema";
import { VideoDetails } from "./fetch-channel-videos";

const MAX_DESCRIPTION_LENGTH = 500;

// Postgres JSON columns reject NUL bytes and unpaired surrogates;
// YouTube descriptions occasionally contain them.
const NUL = String.fromCharCode(0);
function sanitize(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.split(NUL).join("").replace(/[\uD800-\uDFFF]/g, "");
}

export function mapToRawItem(video: VideoDetails, channelUrl: string): RawItem {
  const description = sanitize(video.description);
  const channelName = sanitize(video.channelTitle);
  return {
    source: "YouTube",
    source_url: `https://www.youtube.com/watch?v=${video.videoId}`,
    source_id: video.videoId,
    content_type: "video",
    raw_title: sanitize(video.title) ?? "",
    raw_description: description ? description.slice(0, MAX_DESCRIPTION_LENGTH) : null,
    raw_author: channelName,
    raw_published_at: video.publishedAt,
    thumbnail_url: video.thumbnailUrl,
    captured_text: null,
    tags: [],
    status: "new",
    score: null,
    notes: null,
    metadata: {
      platform: "youtube",
      channel_url: channelUrl,
      channel_name: channelName,
      video_id: video.videoId,
      duration: video.duration,
      view_count: null,
      collected_by: "youtube-research-agent",
      collection_reason: "Collected from monitored channel within freshness window",
    },
  };
}
