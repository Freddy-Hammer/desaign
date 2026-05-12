import { jobId, type Job, type Platform, type JobCategory } from "./schema";
import { categorize } from "./categorize";

export interface ManualEntry {
  company: string;
  title: string;
  location: string;
  url: string;
  posted_date?: string | null;       // ISO 8601
  department?: string | null;
  category?: JobCategory;            // override the auto-derived category
  platform?: Platform;               // defaults to "custom"
}

/**
 * Manually-curated listings from companies the scraper can't reach
 * (email-only agencies, JS-rendered SPAs, proprietary ATS like Apple).
 * These rows are upserted with source='manual' so the daily run does NOT
 * deactivate them — remove them from this array when the role closes.
 */
export const MANUAL_LISTINGS: ManualEntry[] = [
  // Example:
  // {
  //   company: "Pentagram",
  //   title: "Senior Designer, New York",
  //   location: "New York, NY",
  //   url: "https://www.pentagram.com/careers#senior-designer-ny",
  //   posted_date: "2026-04-20",
  //   department: "Design",
  // },
];

export function manualEntriesAsJobs(): Job[] {
  const scrapedAt = new Date().toISOString();
  return MANUAL_LISTINGS.map((m) => ({
    id: jobId(m.company, m.url),
    company: m.company,
    title: m.title,
    location: m.location,
    url: m.url,
    posted_date: m.posted_date ?? null,
    department: m.department ?? null,
    platform: m.platform ?? "custom",
    category: m.category ?? categorize(m.title, m.department ?? null),
    scraped_at: scrapedAt,
    description: null,
  }));
}
