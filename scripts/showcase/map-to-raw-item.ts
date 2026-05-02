import { RawItem } from "../lib/raw-item-schema";
import { ShowcasePick } from "./types";

export function mapToRawItem(pick: ShowcasePick): RawItem {
  return {
    source: pick.source,
    source_url: pick.external_url,
    source_id: pick.source_id,
    content_type: "showcase",
    raw_title: pick.title,
    raw_description: `${pick.award} on ${pick.source}`,
    raw_author: pick.source,
    raw_published_at: pick.published_at,
    thumbnail_url: pick.thumbnail_url,
    captured_text: null,
    tags: ["showcase", pick.source.toLowerCase()],
    status: "new",
    score: null,
    notes: null,
    metadata: {
      platform: "showcase",
      award: pick.award,
      detail_url: pick.detail_url,
      external_url: pick.external_url,
      collected_by: "showcase-collector",
      collection_reason: `${pick.award} on ${pick.source}`,
    },
  };
}
