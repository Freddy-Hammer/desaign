// One-time migration: recompute jobs.id to sha1(company|url), dropping
// title from the hash. Title renames at the same career-page URL had been
// creating duplicate rows; this script merges them into a single canonical
// row and updates the primary key in place.
//
// Usage:
//   npx tsx scripts/jobs/migrate-id-drop-title.ts            # dry-run, prints plan
//   npx tsx scripts/jobs/migrate-id-drop-title.ts --apply    # writes to DB
//
// Safe to re-run: rows already on the new hash are skipped.

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import * as crypto from "crypto";
import { getSupabase } from "../lib/supabase-client";

function newJobId(company: string, url: string): string {
  return crypto
    .createHash("sha1")
    .update(`${company.toLowerCase()}|${url}`)
    .digest("hex")
    .slice(0, 16);
}

interface Row {
  id: string;
  company: string;
  title: string;
  url: string;
  active: boolean;
  first_seen_at: string;
  last_seen_at: string;
  telegram_sent_at: string | null;
  newsletter_status: string | null;
}

function pickSurvivor(group: Row[]): Row {
  // Prefer active rows; among active, the most recently seen wins (newest
  // title rename). Falls back to the same rule among inactives.
  const sorted = [...group].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? "");
  });
  return sorted[0];
}

function mergeMetadata(group: Row[], survivor: Row) {
  let firstSeen = survivor.first_seen_at;
  let lastSeen = survivor.last_seen_at;
  let tg: string | null = survivor.telegram_sent_at;
  let nl: string | null = survivor.newsletter_status;
  const rank = (s: string | null) => (s === "sent" ? 2 : s === "queued" ? 1 : 0);

  for (const r of group) {
    if (r.first_seen_at && r.first_seen_at < firstSeen) firstSeen = r.first_seen_at;
    if (r.last_seen_at && r.last_seen_at > lastSeen) lastSeen = r.last_seen_at;
    // Earliest non-null telegram_sent_at (don't re-broadcast if any
    // historical row already went out to subscribers).
    if (r.telegram_sent_at && (!tg || r.telegram_sent_at < tg)) tg = r.telegram_sent_at;
    if (rank(r.newsletter_status) > rank(nl)) nl = r.newsletter_status;
  }
  return { first_seen_at: firstSeen, last_seen_at: lastSeen, telegram_sent_at: tg, newsletter_status: nl };
}

(async () => {
  const apply = process.argv.includes("--apply");
  const sb = getSupabase();

  const { data, error } = await sb
    .from("jobs")
    .select("id,company,title,url,active,first_seen_at,last_seen_at,telegram_sent_at,newsletter_status");
  if (error) {
    console.error(`load failed: ${error.message}`);
    process.exit(1);
  }
  const rows = (data ?? []) as Row[];
  console.log(`Loaded ${rows.length} jobs.\n`);

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const newId = newJobId(r.company, r.url);
    const arr = groups.get(newId) ?? [];
    arr.push(r);
    groups.set(newId, arr);
  }

  let untouched = 0;
  let renamed = 0;
  let mergedGroups = 0;
  let deletedRows = 0;

  for (const [newId, group] of groups) {
    if (group.length === 1) {
      const r = group[0];
      if (r.id === newId) {
        untouched++;
        continue;
      }
      renamed++;
      console.log(`Rename id  ${r.id} → ${newId}  [${r.company}] ${r.title.slice(0, 60)}`);
      if (apply) {
        const { error: e } = await sb.from("jobs").update({ id: newId }).eq("id", r.id);
        if (e) console.error(`  ✗ ${e.message}`);
      }
      continue;
    }

    mergedGroups++;
    const survivor = pickSurvivor(group);
    const losers = group.filter((r) => r.id !== survivor.id);
    const merged = mergeMetadata(group, survivor);

    console.log(`\nMerge ${group.length} rows → ${newId}  [${survivor.company}]`);
    console.log(`  ✓ KEEP   "${survivor.title.slice(0, 60)}"  id=${survivor.id} active=${survivor.active}`);
    for (const l of losers) {
      console.log(`  ✗ DROP   "${l.title.slice(0, 60)}"  id=${l.id} active=${l.active}`);
    }
    console.log(`  meta: first_seen=${merged.first_seen_at.slice(0, 10)} last_seen=${merged.last_seen_at.slice(0, 10)} tg=${merged.telegram_sent_at?.slice(0, 10) ?? "—"} nl=${merged.newsletter_status ?? "—"}`);

    if (apply) {
      // Delete losers first so the new id slot is free for the survivor.
      const { error: delErr } = await sb.from("jobs").delete().in("id", losers.map((l) => l.id));
      if (delErr) {
        console.error(`  ✗ delete losers: ${delErr.message}`);
        continue;
      }
      deletedRows += losers.length;
      const update: Record<string, unknown> = { ...merged };
      if (survivor.id !== newId) update.id = newId;
      const { error: updErr } = await sb.from("jobs").update(update).eq("id", survivor.id);
      if (updErr) console.error(`  ✗ update survivor: ${updErr.message}`);
    } else {
      deletedRows += losers.length;
    }
  }

  console.log(
    `\nSummary:` +
      `\n  ${untouched} rows already canonical (no change)` +
      `\n  ${renamed} rows need id rename (no duplicates)` +
      `\n  ${mergedGroups} merge groups (${deletedRows} rows will be removed)` +
      `\n  ${rows.length} jobs in → ${groups.size} jobs out`,
  );
  console.log(apply ? "\n✓ Applied." : "\nDry run. Re-run with --apply to write.");
})();
