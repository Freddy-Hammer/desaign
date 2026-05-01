import { Job, jobId } from "../schema";
import { categorize } from "../categorize";

const USER_AGENT = "DesAIgn Radar Job Aggregator (desaign-radar.vercel.app)";

interface AshbyJob {
  id: string;
  title: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  locationName?: string;
  publishedAt?: string;
  updatedAt?: string;
  isListed?: boolean;
  isRemote?: boolean;
  jobUrl?: string;
  applyUrl?: string;
  secondaryLocations?: { location?: string; locationName?: string }[];
}

interface AshbyResponse {
  apiVersion?: string;
  jobs?: AshbyJob[];
}

export async function fetchAshby(company: string, slug: string): Promise<Job[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=false`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Ashby ${slug}: HTTP ${res.status}`);
  }
  const body = (await res.json()) as AshbyResponse;
  const raw = (body.jobs ?? []).filter((j) => j.isListed !== false);
  const scrapedAt = new Date().toISOString();

  return raw.map((j) => {
    const title = j.title.trim();
    const url = j.jobUrl || j.applyUrl || "";
    const primary = j.location || j.locationName || "";
    const secondary = (j.secondaryLocations ?? [])
      .map((s) => s.location || s.locationName || "")
      .filter(Boolean);
    const location = [primary, ...secondary].filter(Boolean).join(", ");
    const department = j.department?.trim() || j.team?.trim() || null;
    const posted = j.publishedAt || j.updatedAt || null;
    return {
      id: jobId(company, title, url),
      company,
      title,
      location,
      url,
      posted_date: posted ? new Date(posted).toISOString() : null,
      department,
      platform: "ashby",
      category: categorize(title, department),
      scraped_at: scrapedAt,
    };
  });
}
