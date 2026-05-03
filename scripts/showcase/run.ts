/**
 * Showcase collector — picks one Site of the Day from each of:
 *   Awwwards, TheFWA, CSSDA
 *
 * Each pick lands in `raw_items` with content_type='showcase' and flows
 * through the same human review → posts → site + Telegram pipeline as
 * YouTube videos. No special-casing in the review UI.
 *
 * Usage:
 *   npx tsx scripts/showcase/run.ts            # dry-run
 *   npx tsx scripts/showcase/run.ts --insert   # write to raw_items
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { pickAwwwards } from "./sources/awwwards";
import { pickFwa } from "./sources/fwa";
import { pickCssda } from "./sources/cssda";
import { mapToRawItem } from "./map-to-raw-item";
import { findExisting } from "../lib/dedup";
import { getSupabase } from "../lib/supabase-client";
import { ShowcasePick } from "./types";

const INSERT_MODE = process.argv.includes("--insert");
const AUTO_PUBLISH = process.argv.includes("--auto-publish");

const SOURCES: { name: string; fn: () => Promise<ShowcasePick | null> }[] = [
  { name: "Awwwards", fn: pickAwwwards },
  { name: "TheFWA", fn: pickFwa },
  { name: "CSSDA", fn: pickCssda },
];

async function main() {
  console.log(`Mode: ${INSERT_MODE ? "INSERT" : "dry-run"}`);
  console.log(`Picking site of the day from ${SOURCES.length} sources\n`);

  const picks: ShowcasePick[] = [];

  for (const { name, fn } of SOURCES) {
    try {
      const pick = await fn();
      if (!pick) {
        console.log(`  ${name.padEnd(12)} ✕ no pick`);
        continue;
      }
      picks.push(pick);
      console.log(
        `  ${name.padEnd(12)} ✓ ${pick.title}  → ${pick.detail_url}`
      );
    } catch (err) {
      console.error(`  ${name.padEnd(12)} ✗ ${(err as Error).message}`);
    }
  }

  if (picks.length === 0) {
    console.log("\nNo picks. Nothing to insert.");
    return;
  }

  const items = picks.map(mapToRawItem);

  // Auto-reject any pick with no thumbnail so it never appears in the queue
  // but still preserves the dedup invariant.
  let autoRejected = 0;
  for (const item of items) {
    if (!item.thumbnail_url) {
      item.status = "rejected";
      item.notes = "Auto-rejected: no thumbnail";
      autoRejected++;
    }
  }

  const dedupInputs = items.map((it) => ({
    source_url: it.source_url,
    source_id: it.source_id,
  }));

  const existing = INSERT_MODE
    ? await findExisting(dedupInputs)
    : new Set<string>();

  const newItems = items.filter((it) => !existing.has(it.source_url));
  const dupCount = items.length - newItems.length;

  console.log(`\nDedup: ${dupCount} already in raw_items`);
  if (autoRejected > 0) console.log(`Auto-reject: ${autoRejected} (no thumbnail)`);

  if (!INSERT_MODE) {
    console.log(`\nDry run: ${newItems.length} rows would be inserted (pass --insert to write)`);
    console.log("\nSample row:");
    console.log(JSON.stringify(newItems[0] ?? {}, null, 2));
    return;
  }

  if (newItems.length === 0) {
    console.log("Nothing new to insert.");
    return;
  }

  if (AUTO_PUBLISH) {
    for (const item of newItems) {
      item.metadata = { ...item.metadata, auto_publish: true };
    }
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
