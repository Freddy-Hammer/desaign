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
  { name: "Hume", platform: "greenhouse", slug: "humeai" },
  { name: "Udio", platform: "greenhouse", slug: "udio" },
  // IDEO embeds Greenhouse listings via JS on ideo.com/careers — slug "ideo" confirmed by boards-api.
  { name: "IDEO", platform: "greenhouse", slug: "ideo" },
  // Mid-market product cos
  { name: "Vercel", platform: "greenhouse", slug: "vercel" },
  { name: "Discord", platform: "greenhouse", slug: "discord" },
  { name: "Squarespace", platform: "greenhouse", slug: "squarespace" },
  { name: "Asana", platform: "greenhouse", slug: "asana" },
  { name: "Mixpanel", platform: "greenhouse", slug: "mixpanel" },
  { name: "Lattice", platform: "greenhouse", slug: "lattice" },
  { name: "Brex", platform: "greenhouse", slug: "brex" },
  // Design agencies with public Greenhouse boards
  { name: "Code and Theory", platform: "greenhouse", slug: "codeandtheory" },
  { name: "AKQA", platform: "greenhouse", slug: "akqa" },
  { name: "R/GA", platform: "greenhouse", slug: "rga" },

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
  // Migrated off Greenhouse since first verification — both now on Ashby.
  { name: "Runway", platform: "ashby", slug: "runway" },
  { name: "Ideogram", platform: "ashby", slug: "ideogram" },
  // Mid-market product cos on Ashby
  { name: "Ramp", platform: "ashby", slug: "ramp" },
  { name: "Mintlify", platform: "ashby", slug: "mintlify" },
  { name: "Modal Labs", platform: "ashby", slug: "modal" },
  { name: "Vanta", platform: "ashby", slug: "vanta" },
  { name: "Substack", platform: "ashby", slug: "substack" },
  { name: "Granola", platform: "ashby", slug: "granola" },
  { name: "Sentry", platform: "ashby", slug: "sentry" },
  { name: "Mux", platform: "ashby", slug: "mux" },
  { name: "Replit", platform: "ashby", slug: "replit" },
  // Boards verified live but currently empty — leave active so they populate when roles open.
  { name: "Mercury", platform: "ashby", slug: "mercury" },
  { name: "Raycast", platform: "ashby", slug: "raycast" },

  // --- Ashby but slug obfuscated; Framer embeds via ashby_jid params ---
  {
    name: "Framer",
    platform: "ashby",
    slug: "framer",
    skip: true,
    todo: "Ashby slug not exposed via API — embedded on framer.com using ashby_jid params. Try slug 'framer' first; if 404, scrape framer.com/careers with Playwright.",
  },

  // --- Custom HTML scrapers ---
  // The custom registry lives in scripts/jobs/scrapers/custom.ts — scrapers are
  // keyed by company.name. Of the original ~15 design-agency targets, only
  // Pentagram exposes structured listings in static HTML; the rest either
  // accept email applications, render listings via JS, or have no openings.
  // Those are skipped with TODOs and feed MANUAL_LISTINGS.md instead.
  { name: "Pentagram", platform: "custom", careersUrl: "https://www.pentagram.com/careers" },

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

  // Design agencies and product cos with no scrapeable listings — manual entry only.
  { name: "Buck", platform: "skip", skip: true, todo: "JS-rendered SPA, no static job markup; applications via careers@buck.co. Manual listings only." },
  { name: "Studio Dumbar", platform: "skip", skip: true, todo: "email-only applications (jobs@studiodumbar.com); page lists no structured roles." },
  { name: "Instrument", platform: "skip", skip: true, todo: "JS-heavy careers page; no static listings detected. Manual entry only." },
  { name: "Ramotion", platform: "skip", skip: true, todo: "applications routed through Google Forms; no machine-readable listings." },
  { name: "Koto", platform: "skip", skip: true, todo: "Teamtailor-hosted at careers.koto.studio. Add a generic Teamtailor scraper later if we add other Teamtailor cos." },
  { name: "Mucho", platform: "skip", skip: true, todo: "no public structured listings; email-based hiring." },
  { name: "Base Design", platform: "skip", skip: true, todo: "email-only (jobs-nyc@basedesign.com); no structured listings." },
  { name: "Manual", platform: "skip", skip: true, todo: "email-only (careers@manualcreative.com)." },
  { name: "Athletics", platform: "skip", skip: true, todo: "Typeform-driven applications; no structured listings." },
  { name: "&Walsh", platform: "skip", skip: true, todo: "email-only; no public listings." },
  { name: "Shopify", platform: "skip", skip: true, todo: "self-hosted careers; JS-rendered, would need Playwright. Manual entry until justified." },
  { name: "Uizard", platform: "skip", skip: true, todo: "LinkedIn-driven; no public ATS endpoint detected." },
  { name: "DesignStudio", platform: "skip", skip: true, todo: "rebranded to Further Group; careers at further.group/careers — verify before scraping." },

  // --- Probed 2026-05-20, no public ATS exposed — don't re-probe ---
  { name: "Loom", platform: "skip", skip: true, todo: "Ashby board exists but empty since Atlassian acquisition; hiring rolled into Atlassian's own system." },
  { name: "Atlassian", platform: "skip", skip: true, todo: "Lever board returns []; main hiring on proprietary jobs.atlassian.com (Workday-like)." },
  { name: "Netflix", platform: "skip", skip: true, todo: "Lever board returns []; design hiring on jobs.netflix.com." },
  { name: "Coda", platform: "skip", skip: true, todo: "404 on GH/Lever/Ashby — acquired by Grammarly, hiring likely on Grammarly board." },
  { name: "Vimeo", platform: "skip", skip: true, todo: "404 on GH/Lever/Ashby — proprietary careers system." },
  { name: "GitHub", platform: "skip", skip: true, todo: "404 on GH/Lever/Ashby — uses Microsoft Careers (Workday)." },
  { name: "Canva", platform: "skip", skip: true, todo: "404 on GH/Lever/Ashby — own careers system at lifeatcanva.com." },
  { name: "Hugging Face", platform: "skip", skip: true, todo: "404 on GH/Lever/Ashby — careers page is a Notion doc, no structured listings." },
  { name: "Replicate", platform: "skip", skip: true, todo: "404 on GH/Lever/Ashby — listings on replicate.com/jobs, would need custom scrape." },
  { name: "Pitch", platform: "skip", skip: true, todo: "404 on GH/Lever/Ashby — likely sunset hiring after pivot." },
  { name: "Bluesky", platform: "skip", skip: true, todo: "404 on GH/Lever/Ashby — careers via standard form, no public ATS." },
  { name: "Retool", platform: "skip", skip: true, todo: "404 on GH/Lever/Ashby despite size — likely on a private board." },
  { name: "Work & Co", platform: "skip", skip: true, todo: "404 on GH/Lever/Ashby — listings on work.co/careers, custom scrape if needed." },
  { name: "Mother Design", platform: "skip", skip: true, todo: "404 on GH/Lever/Ashby — careers via mother-design.com, no public ATS." },
  { name: "Stink Studios", platform: "skip", skip: true, todo: "404 on GH/Lever/Ashby — proprietary careers page." },
  { name: "Huge", platform: "skip", skip: true, todo: "404 on GH/Lever/Ashby — own careers system." },
  { name: "Field.io", platform: "skip", skip: true, todo: "404 on GH/Lever/Ashby — no public ATS, likely email-only." },
];

export function activeCompanies(): CompanyConfig[] {
  return COMPANIES.filter((c) => !c.skip && c.platform !== "skip");
}

export function companiesByPlatform(p: Platform): CompanyConfig[] {
  return activeCompanies().filter((c) => c.platform === p);
}
