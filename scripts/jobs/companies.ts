import type { Platform } from "./schema";

export interface CompanyConfig {
  name: string;
  platform: Platform | "skip";
  /** Slug for greenhouse/lever/ashby APIs */
  slug?: string;
  /** Careers page URL — required for custom scrapers, informational otherwise */
  careersUrl?: string;
  /** If set, scraper will skip this company. Useful while building or after a site breaks. */
  skip?: boolean;
  /** Why it's skipped or other handling notes */
  todo?: string;
}

export const COMPANIES: CompanyConfig[] = [
  // --- Greenhouse (verified via boards-api 200) ---
  { name: "Figma", platform: "greenhouse", slug: "figma" },
  { name: "Anthropic", platform: "greenhouse", slug: "anthropic" },
  { name: "Airbnb", platform: "greenhouse", slug: "airbnb" },
  { name: "Duolingo", platform: "greenhouse", slug: "duolingo" },
  { name: "Webflow", platform: "greenhouse", slug: "webflow" },
  { name: "MetaLab", platform: "greenhouse", slug: "metalab" },
  { name: "Runway", platform: "greenhouse", slug: "runway" },
  { name: "Ideogram", platform: "greenhouse", slug: "ideogram" },
  { name: "Hume", platform: "greenhouse", slug: "humeai" },
  { name: "Udio", platform: "greenhouse", slug: "udio" },

  // --- Lever (verified via api.lever.co) ---
  { name: "Spotify", platform: "lever", slug: "spotify" },
  // Frog Design moved under Capgemini Invent — no public Greenhouse/Lever/Ashby board found.
  { name: "Frog Design", platform: "skip", skip: true, todo: "Frog rolled into Capgemini Invent; hiring likely via Capgemini Workday — manual listings only" },

  // --- Ashby (verified via posting-api / jobs.ashbyhq.com) ---
  { name: "Notion", platform: "ashby", slug: "Notion" }, // capitalized slug
  { name: "Linear", platform: "ashby", slug: "linear" },
  { name: "Tldraw", platform: "ashby", slug: "tldraw" },
  { name: "OpenAI", platform: "ashby", slug: "openai" },
  { name: "Pika", platform: "ashby", slug: "pika" },
  { name: "Krea", platform: "ashby", slug: "krea" },
  { name: "Recraft", platform: "ashby", slug: "recraft" },
  { name: "Cursor", platform: "ashby", slug: "cursor" },
  { name: "Perplexity", platform: "ashby", slug: "perplexity" },
  { name: "ElevenLabs", platform: "ashby", slug: "elevenlabs" },
  { name: "Character.ai", platform: "ashby", slug: "character" },
  { name: "Suno", platform: "ashby", slug: "suno" },
  { name: "Browser Company", platform: "ashby", slug: "The Browser Company", todo: "slug has spaces — confirm URL encoding works" },

  // --- Ashby but slug obfuscated; Framer embeds via ashby_jid params ---
  {
    name: "Framer",
    platform: "ashby",
    slug: "framer",
    skip: true,
    todo: "Ashby slug not exposed via API — embedded on framer.com using ashby_jid params. Try slug 'framer' first; if 404, scrape framer.com/careers with Playwright.",
  },

  // --- Custom HTML (design agencies + a few product cos with proprietary ATS) ---
  { name: "Pentagram", platform: "custom", careersUrl: "https://pentagram.com/careers" },
  { name: "Buck", platform: "custom", careersUrl: "https://buck.co/careers", todo: "agency uses careers@buck.co email — may have no structured listings" },
  { name: "Studio Dumbar", platform: "custom", careersUrl: "https://studiodumbar.com/jobs" },
  { name: "IDEO", platform: "custom", careersUrl: "https://www.ideo.com/careers" },
  { name: "Instrument", platform: "custom", careersUrl: "https://www.instrument.com/careers" },
  { name: "Ramotion", platform: "custom", careersUrl: "https://www.ramotion.com/careers", todo: "applications via Google Forms — listings may exist on page" },
  { name: "Koto", platform: "custom", careersUrl: "https://careers.koto.studio/jobs", todo: "uses Teamtailor — could become a generic Teamtailor scraper later" },
  { name: "Mucho", platform: "custom", careersUrl: "https://wearemucho.com" },
  { name: "Base Design", platform: "custom", careersUrl: "https://www.basedesign.com/jobs" },
  { name: "Manual", platform: "custom", careersUrl: "https://manualcreative.com/careers" },
  { name: "Athletics", platform: "custom", careersUrl: "https://athleticsnyc.com/careers" },
  { name: "&Walsh", platform: "custom", careersUrl: "https://andwalsh.com" },
  { name: "Shopify", platform: "custom", careersUrl: "https://www.shopify.com/careers", todo: "self-hosted ATS — needs Playwright" },
  { name: "Uizard", platform: "custom", careersUrl: "https://uizard.io/careers", todo: "appears LinkedIn-driven, possibly Workable — verify before scraping" },
  { name: "DesignStudio", platform: "custom", careersUrl: "https://www.further.group/careers", todo: "rebranded to Further Group — verify before scraping" },

  // --- Skip: blocked, closed, acquired, or unscrapeable ---
  { name: "Apple", platform: "skip", careersUrl: "https://jobs.apple.com", skip: true, todo: "proprietary ATS — manual listings only" },
  { name: "Calm", platform: "skip", skip: true, todo: "Cloudflare 403" },
  { name: "Midjourney", platform: "skip", skip: true, todo: "403/404 on all probes — manual listings only" },
  { name: "Hi Studio", platform: "skip", skip: true, todo: "site shows 'Launching Soon', no careers" },
  { name: "Magnific", platform: "skip", skip: true, todo: "rebranded to Freepik, no separate careers" },
  { name: "Galileo AI", platform: "skip", skip: true, todo: "acquired by Google, became Stitch" },
  { name: "Ueno", platform: "skip", skip: true, todo: "careers page 404" },
  { name: "Collins", platform: "skip", skip: true, todo: "careers page 404" },
  { name: "Moving Brands", platform: "skip", skip: true, todo: "no careers page found" },
  { name: "Wolff Olins", platform: "skip", skip: true, todo: "no public careers page" },
  { name: "Cron / Notion Calendar", platform: "skip", skip: true, todo: "folded into Notion's Ashby board" },
  { name: "Headspace", platform: "skip", skip: true, todo: "boards-api 404 despite web slug 'hs' working — needs HTML scrape via Playwright" },
];

export function activeCompanies(): CompanyConfig[] {
  return COMPANIES.filter((c) => !c.skip && c.platform !== "skip");
}

export function companiesByPlatform(p: Platform): CompanyConfig[] {
  return activeCompanies().filter((c) => c.platform === p);
}
