import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { activeCompanies, type CompanyConfig } from "./companies";
import { fetchGreenhouse } from "./scrapers/greenhouse";
import { fetchLever } from "./scrapers/lever";
import { fetchAshby } from "./scrapers/ashby";
import { CUSTOM_SCRAPERS } from "./scrapers/custom";
import { filterJob } from "./filter";
import { manualEntriesAsJobs } from "./manual-listings";
import { upsertJobs, deactivateUnseen } from "./lib/db";
import type { Job } from "./schema";

const INSERT = process.argv.includes("--insert");
const VERBOSE = process.argv.includes("--verbose");

interface Result {
  company: string;
  platform: string;
  raw: number;
  kept: number;
  error?: string;
}

async function fetchOne(c: CompanyConfig): Promise<Job[]> {
  switch (c.platform) {
    case "greenhouse":
      return fetchGreenhouse(c.name, c.slug!);
    case "lever":
      return fetchLever(c.name, c.slug!);
    case "ashby":
      return fetchAshby(c.name, c.slug!);
    case "custom": {
      const scraper = CUSTOM_SCRAPERS[c.name];
      if (!scraper) throw new Error(`no custom scraper registered for "${c.name}"`);
      return scraper();
    }
    default:
      throw new Error(`unknown platform "${c.platform}"`);
  }
}

async function main() {
  const companies = activeCompanies();
  console.log(`Mode: ${INSERT ? "INSERT" : "dry-run"}`);
  console.log(`Scraping ${companies.length} active companies\n`);

  const results: Result[] = [];
  const seenJobs = new Map<string, Job>();

  for (const c of companies) {
    try {
      const raw = await fetchOne(c);
      const kept = raw.filter((j) => filterJob(j).include);
      for (const j of kept) seenJobs.set(j.id, j); // dedup by id
      results.push({ company: c.name, platform: c.platform, raw: raw.length, kept: kept.length });
      if (VERBOSE) {
        console.log(`  ${c.name.padEnd(22)} ${c.platform.padEnd(10)} raw=${String(raw.length).padStart(4)}  kept=${kept.length}`);
      }
    } catch (err) {
      const msg = (err as Error).message;
      results.push({ company: c.name, platform: c.platform, raw: 0, kept: 0, error: msg });
      console.warn(`  ! ${c.name} (${c.platform}) failed: ${msg}`);
    }
    const delay = c.platform === "custom" ? 3000 : 1000;
    await new Promise((r) => setTimeout(r, delay));
  }

  // Manual listings — folded in after scrapers; their IDs survive across runs.
  const manual = manualEntriesAsJobs();
  for (const j of manual) seenJobs.set(j.id, j);

  // Sort by posted_date desc (nulls last)
  const all = Array.from(seenJobs.values()).sort((a, b) => {
    if (!a.posted_date && !b.posted_date) return 0;
    if (!a.posted_date) return 1;
    if (!b.posted_date) return -1;
    return b.posted_date.localeCompare(a.posted_date);
  });

  // ---- Reporting ----
  console.log("\n=== Per-company ===");
  for (const r of results.sort((a, b) => b.kept - a.kept)) {
    if (r.error) {
      console.log(`  ! ${r.company.padEnd(22)} ${r.platform.padEnd(10)} ${r.error}`);
    } else {
      console.log(`  - ${r.company.padEnd(22)} ${r.platform.padEnd(10)} raw=${String(r.raw).padStart(4)}  kept=${r.kept}`);
    }
  }

  console.log(`\nManual listings: ${manual.length}`);
  console.log(`Total unique designer jobs: ${all.length}`);
  const failures = results.filter((r) => r.error);
  if (failures.length > 0) {
    console.log(`Companies failed: ${failures.length} (continued past them)`);
  }

  if (!INSERT) {
    console.log("\n(dry-run — pass --insert to write to Supabase)");
    return;
  }

  console.log("\n=== Writing to Supabase ===");
  // Manual listings get source='manual'; scraper output gets source='scraper'.
  // db.upsertJobs writes everything as 'scraper' by default — split it.
  const manualIds = new Set(manual.map((m) => m.id));
  const scraped = all.filter((j) => !manualIds.has(j.id));
  const { upserted: scrapedUp } = await upsertJobs(scraped);
  console.log(`  scraper rows upserted: ${scrapedUp}`);

  if (manual.length > 0) {
    // Manual rows take a slightly different upsert because they need source='manual'.
    // Reuse upsertJobs but patch source via a follow-up update keyed by id.
    await upsertJobs(manual);
    const sb = (await import("../lib/supabase-client")).getSupabase();
    const { error } = await sb
      .from("jobs")
      .update({ source: "manual" })
      .in("id", Array.from(manualIds));
    if (error) console.warn(`  manual source flag update failed: ${error.message}`);
    else console.log(`  manual rows tagged: ${manualIds.size}`);
  }

  const seenIds = scraped.map((j) => j.id);
  const { deactivated } = await deactivateUnseen(seenIds);
  console.log(`  scraper rows deactivated (no longer listed): ${deactivated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
