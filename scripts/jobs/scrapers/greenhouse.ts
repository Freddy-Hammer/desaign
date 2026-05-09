import { Job, jobId } from "../schema";
import { categorize } from "../categorize";
import { stripHtml } from "../lib/text";

const USER_AGENT = "DesAIgn Radar Job Aggregator (desaign-radar.vercel.app)";

interface GreenhouseJob {
  id: number;
  internal_job_id?: number;
  title: string;
  updated_at?: string;
  first_published?: string;
  absolute_url: string;
  content?: string;
  location?: { name?: string };
  offices?: { name?: string }[];
  departments?: { name?: string }[];
}

interface GreenhouseResponse {
  jobs?: GreenhouseJob[];
}

export async function fetchGreenhouse(
  company: string,
  slug: string
): Promise<Job[]> {
  // ?content=true returns the full job description HTML in `content`.
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Greenhouse ${slug}: HTTP ${res.status}`);
  }
  const body = (await res.json()) as GreenhouseResponse;
  const raw = body.jobs ?? [];
  const scrapedAt = new Date().toISOString();

  return raw.map((j) => {
    const title = j.title.trim();
    const url = j.absolute_url;
    const location =
      j.location?.name?.trim() ||
      j.offices?.map((o) => o.name).filter(Boolean).join(", ") ||
      "";
    const department = j.departments?.[0]?.name?.trim() || null;
    const posted = j.first_published || j.updated_at || null;
    return {
      id: jobId(company, title, url),
      company,
      title,
      location,
      url,
      posted_date: posted ? new Date(posted).toISOString() : null,
      department,
      platform: "greenhouse",
      category: categorize(title, department),
      scraped_at: scrapedAt,
      description: stripHtml(j.content),
    };
  });
}
