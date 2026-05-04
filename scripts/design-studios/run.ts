import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { scrapeStudio } from "./scrape-studio";
import { mapToRawItem } from "./map-to-raw-item";
import { findExisting } from "../lib/dedup";
import { getSupabase } from "../lib/supabase-client";
import { RawItem } from "../lib/raw-item-schema";

// --- Default configuration ---
const DEFAULT_STUDIOS: { name: string; url: string }[] = [
  { name: "Pentagram", url: "https://www.pentagram.com/work" },
  { name: "Koto", url: "https://koto.com/work" },
  { name: "Mucho", url: "https://wearemucho.com/work" },
  { name: "Buck", url: "https://buck.co/work" },
  { name: "Studio Dumbar", url: "https://studiodumbar.com/work" },
  { name: "Collins", url: "https://wearecollins.com/case-studies" },
  { name: "Mouthwash", url: "https://mouthwash.studio/work/" },
  { name: "Pacifica", url: "https://thisispacifica.com/" },
  { name: "Of Form", url: "https://offormdesign.com/" },
  { name: "Studio Foundry", url: "https://studiofoundry.co.uk/projects/" },
  { name: "Applied", url: "https://helloapplied.com/work/" },
  { name: "Studio Nari", url: "https://www.studionari.co.uk/" },
  { name: "Studio Miles", url: "https://studiomiles.ca/projets" },
  { name: "Rudy", url: "https://ru-dy.com/work" },
  { name: "Studio Plankton", url: "https://www.studioplankton.com/work" },
  { name: "Snask", url: "https://snask.com/our-work/" },
  { name: "Tiquismiquis", url: "https://tiquismiquis.club/proyectos" },
  { name: "Red Antler", url: "https://www.redantler.com/work" },
  { name: "Field", url: "https://field.io/work" },
  { name: "Newkid", url: "https://newkid.services/work" },
];
// -----------------------------

// 1 case per studio per run — always the newest item from the work listing.
// Dedup ensures old cases are never re-inserted; new cases appear at position 1.
const DEFAULT_MAX_ITEMS_PER_STUDIO = 1;

const INSERT_MODE = process.argv.includes("--insert");

function readNumberArg(flag: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (!arg) return fallback;
  const n = parseInt(arg.slice(flag.length + 1), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// --studios="Name::https://url.com/work,Name2::https://url2.com/work"
const studiosArg = process.argv.find((a) => a.startsWith("--studios="));
const STUDIOS = studiosArg
  ? studiosArg
      .replace("--studios=", "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        const sep = entry.indexOf("::");
        return sep === -1
          ? { name: entry, url: entry }
          : { name: entry.slice(0, sep).trim(), url: entry.slice(sep + 2).trim() };
      })
  : DEFAULT_STUDIOS;

const MAX_ITEMS_PER_STUDIO = readNumberArg("--max-items", DEFAULT_MAX_ITEMS_PER_STUDIO);

async function main() {
  console.log(`Scraping ${STUDIOS.length} design studio(s), max ${MAX_ITEMS_PER_STUDIO}/studio`);
  console.log(`Mode: ${INSERT_MODE ? "INSERT" : "dry-run"}\n`);

  const allCandidates: RawItem[] = [];

  for (const studio of STUDIOS) {
    try {
      const cases = await scrapeStudio(studio.name, studio.url, MAX_ITEMS_PER_STUDIO);
      console.log(`Studio: ${studio.name} → ${cases.length} latest cases`);
      for (const c of cases) {
        allCandidates.push(mapToRawItem(c));
      }
    } catch (err) {
      console.error(`Error scraping ${studio.name}:`, (err as Error).message);
    }
  }

  if (allCandidates.length === 0) {
    console.log("\nNo candidates found.");
    return;
  }

  const dedupInputs = allCandidates.map((item) => ({
    source_url: item.source_url,
    source_id: item.source_id,
  }));

  const existing = INSERT_MODE
    ? await findExisting(dedupInputs)
    : new Set<string>();

  const newItems = allCandidates.filter((item) => !existing.has(item.source_url));
  const dupCount = allCandidates.length - newItems.length;

  // Auto-reject rows with no thumbnail so they preserve the dedup invariant
  // but never appear in the human review queue.
  let autoRejected = 0;
  for (const item of newItems) {
    if (!item.thumbnail_url) {
      item.status = "rejected";
      item.notes = "Auto-rejected: no thumbnail";
      autoRejected++;
    }
  }

  console.log(`\nDedup: ${dupCount} already in raw_items`);
  if (autoRejected > 0) {
    console.log(`Auto-reject: ${autoRejected} item(s) without thumbnail`);
  }

  if (!INSERT_MODE) {
    console.log(`\nDry run: ${newItems.length} rows would be inserted (pass --insert to write)`);
    if (newItems[0]) {
      console.log("\nSample row:");
      console.log(JSON.stringify(newItems[0], null, 2));
    }
    return;
  }

  if (newItems.length === 0) {
    console.log("Nothing new to insert.");
    return;
  }

  const { error } = await getSupabase().from("raw_items").insert(newItems);

  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }

  console.log(`Inserted ${newItems.length} rows into raw_items`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
