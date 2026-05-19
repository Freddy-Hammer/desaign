/**
 * Re-resolves the thumbnail of every unreviewed design-studio row in
 * raw_items by rendering its project page and grabbing the real case-study
 * hero image. Use after a scraper change, or whenever studio thumbnails
 * look wrong (placeholders, social cards, homepage screenshots).
 *
 *   npx tsx scripts/design-studios/refresh-thumbnails.ts --dry-run  # preview
 *   npx tsx scripts/design-studios/refresh-thumbnails.ts            # write
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getSupabase } from "../lib/supabase-client";
import { resolveHeroes, isJunkSrc, fetchProjectThumbnail } from "./scrape-studio";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const sb = getSupabase();

  const { data, error } = await sb
    .from("raw_items")
    .select("id, source, raw_title, source_url, thumbnail_url")
    .eq("status", "new")
    .eq("metadata->>platform", "design_studio");

  if (error) throw new Error(`Fetch failed: ${error.message}`);
  if (!data || data.length === 0) {
    console.log("No unreviewed design-studio rows to refresh.");
    return;
  }

  console.log(`Re-resolving thumbnails for ${data.length} row(s)${DRY_RUN ? " [DRY RUN]" : ""}\n`);

  const heroes = await resolveHeroes(data.map((r) => r.source_url));

  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const r of data) {
    // Prefer the rendered case hero; fall back to a static og:image scrape.
    let hero = heroes.get(r.source_url) ?? null;
    if (!hero) {
      const stat = await fetchProjectThumbnail(r.source_url);
      if (stat && !isJunkSrc(stat)) hero = stat;
    }
    if (!hero) {
      console.log(`  ✗ ${r.source} — ${r.raw_title}: no image found`);
      failed++;
      continue;
    }
    if (hero === r.thumbnail_url) {
      unchanged++;
      continue;
    }
    const wasJunk = isJunkSrc(r.thumbnail_url) ? " (was placeholder)" : "";
    console.log(`  ✓ ${r.source} — ${r.raw_title}${wasJunk}`);
    console.log(`     ${hero}`);

    if (!DRY_RUN) {
      const { error: ue } = await sb
        .from("raw_items")
        .update({ thumbnail_url: hero })
        .eq("id", r.id);
      if (ue) {
        console.error(`     update failed: ${ue.message}`);
        failed++;
        continue;
      }
    }
    updated++;
  }

  console.log(
    `\nDone. Updated: ${updated}, unchanged: ${unchanged}, failed: ${failed}` +
      (DRY_RUN ? " [DRY RUN — nothing written]" : ""),
  );
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
