/**
 * Re-hosts design-studio thumbnails onto Supabase Storage so images that
 * block hotlinking (403 on a cross-domain Referer, e.g. imaginaryforces.com)
 * or serve expiring CDN URLs keep rendering on the live site.
 *
 * Covers both unreviewed raw_items rows and already-published posts.
 * Skips URLs that are already on Supabase Storage, so it is safe to rerun.
 *
 *   npx tsx scripts/design-studios/rehost-thumbnails.ts --dry-run  # preview
 *   npx tsx scripts/design-studios/rehost-thumbnails.ts            # write
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getSupabase } from "../lib/supabase-client";
import { storeImage } from "../lib/store-image";

const DRY_RUN = process.argv.includes("--dry-run");

// A URL already served from our own Supabase Storage 'media' bucket.
function isRehosted(url: string | null): boolean {
  return !!url && url.includes("/storage/v1/object/public/media/");
}

async function rehostRows(
  table: "raw_items" | "posts",
  rows: { id: string; label: string; thumbnail_url: string | null }[],
): Promise<{ updated: number; skipped: number; failed: number }> {
  const sb = getSupabase();
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of rows) {
    if (!r.thumbnail_url || isRehosted(r.thumbnail_url)) {
      skipped++;
      continue;
    }
    try {
      const permanent = DRY_RUN
        ? "(would re-host)"
        : await storeImage(r.thumbnail_url, "studios");
      console.log(`  ✓ [${table}] ${r.label}`);
      console.log(`     ${permanent}`);
      if (!DRY_RUN) {
        const { error } = await sb
          .from(table)
          .update({ thumbnail_url: permanent })
          .eq("id", r.id);
        if (error) throw new Error(error.message);
      }
      updated++;
    } catch (err) {
      console.error(`  ✗ [${table}] ${r.label}: ${(err as Error).message}`);
      failed++;
    }
  }
  return { updated, skipped, failed };
}

async function main() {
  const sb = getSupabase();

  // Unreviewed studio rows still in the inbox.
  const { data: raw, error: re } = await sb
    .from("raw_items")
    .select("id, source, raw_title, thumbnail_url")
    .eq("status", "new")
    .eq("metadata->>platform", "design_studio");
  if (re) throw new Error(`raw_items fetch failed: ${re.message}`);

  // Published case-study posts read by the public site.
  const { data: posts, error: pe } = await sb
    .from("posts")
    .select("id, source, title, thumbnail_url")
    .eq("category", "Case Study");
  if (pe) throw new Error(`posts fetch failed: ${pe.message}`);

  console.log(
    `Re-hosting studio thumbnails — ${raw?.length ?? 0} raw_items, ` +
      `${posts?.length ?? 0} posts${DRY_RUN ? " [DRY RUN]" : ""}\n`,
  );

  const rawResult = await rehostRows(
    "raw_items",
    (raw ?? []).map((r) => ({
      id: r.id,
      label: `${r.source} — ${r.raw_title}`,
      thumbnail_url: r.thumbnail_url,
    })),
  );
  const postResult = await rehostRows(
    "posts",
    (posts ?? []).map((r) => ({
      id: r.id,
      label: `${r.source} — ${r.title}`,
      thumbnail_url: r.thumbnail_url,
    })),
  );

  const updated = rawResult.updated + postResult.updated;
  const skipped = rawResult.skipped + postResult.skipped;
  const failed = rawResult.failed + postResult.failed;
  console.log(
    `\nDone. Re-hosted: ${updated}, already permanent: ${skipped}, failed: ${failed}` +
      (DRY_RUN ? " [DRY RUN — nothing written]" : ""),
  );
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
