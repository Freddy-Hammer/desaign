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
  location: string | null;
  url: string;
  posted_date: string | null;
  department: string | null;
  platform: string;
  category: JobCategory;
  active: boolean;
  source: string;
  first_seen_at: string;
  last_seen_at: string;
}
