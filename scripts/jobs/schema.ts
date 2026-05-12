import * as crypto from "crypto";

export type Platform = "greenhouse" | "lever" | "ashby" | "custom";

export type JobCategory =
  | "Design"
  | "Brand"
  | "Motion"
  | "Design Eng"
  | "AI/Creative"
  | "Other";

export interface Job {
  id: string;
  company: string;
  title: string;
  location: string;
  url: string;
  posted_date: string | null;
  department: string | null;
  platform: Platform;
  category: JobCategory;
  scraped_at: string;
  description: string | null;
}

// ID is hashed from company + URL only. Title is intentionally excluded:
// companies often rename the same role (same career-page URL) and including
// the title in the hash would create a duplicate row + a false "new job"
// every time a title is edited.
export function jobId(company: string, url: string): string {
  return crypto
    .createHash("sha1")
    .update(`${company.toLowerCase()}|${url}`)
    .digest("hex")
    .slice(0, 16);
}
