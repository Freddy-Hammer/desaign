import { Job, jobId } from "../schema";
import { categorize } from "../categorize";
import { stripHtml } from "../lib/text";

const USER_AGENT = "DesAIgn Radar Job Aggregator (desaign-radar.vercel.app)";

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string;
  createdAt?: number;
  description?: string;
  descriptionPlain?: string;
  lists?: { text?: string; content?: string }[];
  additional?: string;
  additionalPlain?: string;
  categories?: {
    team?: string;
    department?: string;
    location?: string;
    commitment?: string;
    allLocations?: string[];
  };
}

function leverFullDescription(p: LeverPosting): string | null {
  // Prefer plain-text fields; fall back to HTML stripped. Lever splits the
  // posting into description (intro), lists (bullets), and additional (footer).
  const parts: (string | null | undefined)[] = [
    p.descriptionPlain ?? stripHtml(p.description),
    ...(p.lists ?? []).map((l) => stripHtml(l.content) ?? l.text ?? ""),
    p.additionalPlain ?? stripHtml(p.additional),
  ];
  const joined = parts.filter(Boolean).join("\n\n").trim();
  return joined || null;
}

export async function fetchLever(company: string, slug: string): Promise<Job[]> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Lever ${slug}: HTTP ${res.status}`);
  }
  const raw = (await res.json()) as LeverPosting[];
  const scrapedAt = new Date().toISOString();

  return raw.map((p) => {
    const title = p.text.trim();
    const url = p.hostedUrl;
    const cats = p.categories ?? {};
    const location =
      cats.location?.trim() ||
      (cats.allLocations ?? []).filter(Boolean).join(", ") ||
      "";
    const department = cats.department?.trim() || cats.team?.trim() || null;
    const posted = p.createdAt ? new Date(p.createdAt).toISOString() : null;
    return {
      id: jobId(company, title, url),
      company,
      title,
      location,
      url,
      posted_date: posted,
      department,
      platform: "lever",
      category: categorize(title, department),
      scraped_at: scrapedAt,
      description: leverFullDescription(p),
    };
  });
}
