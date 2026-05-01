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
}

export function jobId(company: string, title: string, url: string): string {
  return crypto
    .createHash("sha1")
    .update(`${company.toLowerCase()}|${title.toLowerCase()}|${url}`)
    .digest("hex")
    .slice(0, 16);
}
