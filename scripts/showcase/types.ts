export interface ShowcasePick {
  source: "Awwwards" | "TheFWA" | "CSSDA" | "Siteinspire";
  award: string;
  title: string;
  external_url: string;
  detail_url: string;
  thumbnail_url: string | null;
  published_at: string | null;
  source_id: string;
}
