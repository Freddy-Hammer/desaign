/**
 * One-time cleanup: for each studio, keep only the most recently inserted
 * raw_item with status='new' and content_type='case_study'. Reject the rest.
 *
 * Already-approved or already-rejected rows are untouched.
 *
 * Run once:
 *   npx tsx scripts/design-studios/cleanup-old-cases.ts
 * Add --dry-run to preview without writing.
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getSupabase } from "../lib/supabase-client";

const DRY_RUN = !process.argv.includes("--apply");

async function main() {
  const sb = getSupabase();

  const { data: rows, error } = await sb
    .from("raw_items")
    .select("id, source, created_at, metadata")
    .eq("status", "new")
    .eq("content_type", "case_study")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) {
    console.log("No pending studio cases found — nothing to clean up.");
    return;
  }

  // Group by studio name (metadata.studio_name ?? source)
  const byStudio = new Map<string, typeof rows>();
  for (const row of rows) {
    const studio: string = (row.metadata as any)?.studio_name ?? row.source ?? "unknown";
    if (!byStudio.has(studio)) byStudio.set(studio, []);
    byStudio.get(studio)!.push(row);
  }

  const toReject: string[] = [];
  console.log(`\nPending studio cases by studio (newest-first, will keep ✓ / reject ✗):\n`);

  for (const [studio, studioRows] of byStudio) {
    // Already sorted newest-first from the query — keep index 0, reject the rest.
    const [keep, ...old] = studioRows;
    const keepDate = new Date(keep.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    console.log(`  ${studio}`);
    console.log(`    ✓ keep  [${keepDate}] ${keep.id}`);
    for (const r of old) {
      const d = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      console.log(`    ✗ reject [${d}] ${r.id}`);
      toReject.push(r.id);
    }
  }

  console.log(`\nSummary: keep ${byStudio.size} · reject ${toReject.length}`);

  if (DRY_RUN) {
    console.log("\nDry run — pass --apply to write changes.");
    return;
  }

  if (toReject.length === 0) {
    console.log("Nothing to reject.");
    return;
  }

  const { error: updateErr } = await sb
    .from("raw_items")
    .update({ status: "rejected", notes: "Auto-rejected: older studio case (cleanup-old-cases)" })
    .in("id", toReject);

  if (updateErr) throw new Error(updateErr.message);
  console.log(`\nRejected ${toReject.length} old studio cases. Done.`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
