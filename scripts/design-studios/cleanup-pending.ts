/**
 * Hard-deletes design-studio rows from raw_items where status='new'.
 *
 * Use case: clear out unreviewed studio cases so the next collect run only
 * surfaces the latest cases (now capped at 10/studio in run.ts).
 *
 * Trade-off: deleting breaks the dedup invariant for those URLs — they can
 * be re-collected. That is the intent here. Approved/rejected rows are
 * never touched, so their dedup history is preserved.
 *
 * Usage:
 *   npx tsx scripts/design-studios/cleanup-pending.ts --dry-run
 *   npx tsx scripts/design-studios/cleanup-pending.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getSupabase } from "../lib/supabase-client";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const sb = getSupabase();

  const { data: pending, error: selErr } = await sb
    .from("raw_items")
    .select("id, source, raw_title")
    .eq("status", "new")
    .eq("metadata->>platform", "design_studio");

  if (selErr) {
    console.error("Select failed:", selErr.message);
    process.exit(1);
  }

  const rows = pending ?? [];
  console.log(`${rows.length} unreviewed studio case(s) in raw_items${DRY_RUN ? " [DRY RUN]" : ""}`);

  if (rows.length === 0) return;

  const bySource = new Map<string, number>();
  for (const r of rows) bySource.set(r.source ?? "?", (bySource.get(r.source ?? "?") ?? 0) + 1);
  for (const [src, n] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src}: ${n}`);
  }

  if (DRY_RUN) {
    console.log("\nDry run — nothing deleted. Re-run without --dry-run to apply.");
    return;
  }

  const ids = rows.map((r) => r.id);
  const { error: delErr } = await sb.from("raw_items").delete().in("id", ids);
  if (delErr) {
    console.error("Delete failed:", delErr.message);
    process.exit(1);
  }
  console.log(`\nDeleted ${ids.length} row(s).`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
