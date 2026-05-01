import * as cheerio from "cheerio";
import { Job, jobId } from "../schema";
import { categorize } from "../categorize";

const USER_AGENT = "DesAIgn Radar Job Aggregator (desaign-radar.vercel.app)";

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

/**
 * Pentagram lists openings under <h3 id="rolesHeading">Open Positions</h3>.
 * When there are none, the page renders a placeholder <h3 class="text-primary">
 * containing "no open positions". Otherwise listings appear as headings or
 * links in the same column. We extract any anchor + heading pairs that look
 * like roles, ignoring the placeholder.
 */
async function fetchPentagram(): Promise<Job[]> {
  const company = "Pentagram";
  const careersUrl = "https://www.pentagram.com/careers";
  const html = await fetchHtml(careersUrl);
  const $ = cheerio.load(html);
  const scrapedAt = new Date().toISOString();

  const rolesHeading = $("#rolesHeading");
  if (rolesHeading.length === 0) return [];
  const section = rolesHeading.closest(".keyline-t").length
    ? rolesHeading.closest(".keyline-t")
    : rolesHeading.parent().parent();

  // If the placeholder "no open positions" text is present, no jobs.
  const sectionText = section.text();
  if (/no open positions/i.test(sectionText)) return [];

  // Otherwise extract listings — try anchors with text that looks like a role title.
  const jobs: Job[] = [];
  section.find("a").each((_, el) => {
    const $a = $(el);
    const text = $a.text().trim();
    const href = $a.attr("href") ?? "";
    if (!text || text.length < 3 || text.length > 120) return;
    if (!href) return;
    const url = href.startsWith("http") ? href : new URL(href, careersUrl).toString();
    jobs.push({
      id: jobId(company, text, url),
      company,
      title: text,
      location: "London, UK", // Pentagram's main office; refine if listings expose locations
      url,
      posted_date: null,
      department: null,
      platform: "custom",
      category: categorize(text, null),
      scraped_at: scrapedAt,
    });
  });

  return jobs;
}

type CustomFetcher = () => Promise<Job[]>;

export const CUSTOM_SCRAPERS: Record<string, CustomFetcher> = {
  Pentagram: fetchPentagram,
};
