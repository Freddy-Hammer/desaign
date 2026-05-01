export interface RawItem {
  source: string;
  source_url: string;
  source_id: string;
  content_type: string;
  raw_title: string;
  raw_description: string | null;
  raw_author: string | null;
  raw_published_at: string | null;
  thumbnail_url: string | null;
  captured_text: string | null;
  tags: string[];
  status: "new" | "reviewed" | "approved" | "rejected";
  score: number | null;
  notes: string | null;
  metadata: Record<string, unknown>;
}
