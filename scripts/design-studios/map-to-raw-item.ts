import { RawItem } from "../lib/raw-item-schema";
import { StudioCase } from "./scrape-studio";

export function mapToRawItem(c: StudioCase): RawItem {
  return {
    source: c.studioName,
    source_url: c.projectUrl,
    source_id: c.projectSlug,
    content_type: "case_study",
    raw_title: c.title,
    raw_description: null,
    raw_author: null,
    raw_published_at: null,
    thumbnail_url: c.thumbnailUrl,
    captured_text: null,
    tags: [],
    status: "new",
    score: null,
    notes: null,
    metadata: {
      platform: "design_studio",
      studio_name: c.studioName,
      studio_url: c.studioBaseUrl,
      project_slug: c.projectSlug,
      collected_by: "design-studio-scraper",
      collection_reason: "Case study from monitored design studio portfolio",
    },
  };
}
