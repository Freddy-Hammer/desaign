import { getSupabase } from "../../lib/supabase-client";
import type { Job } from "../schema";

const BATCH = 200;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function upsertJobs(jobs: Job[]): Promise<{ upserted: number; reopened: number }> {
  if (jobs.length === 0) return { upserted: 0, reopened: 0 };
  const sb = getSupabase();
  const now = new Date().toISOString();

  // Reopening detection: any job whose previous row had active=false is
  // treated as a fresh posting — bump first_seen_at, clear telegram_sent_at
  // and newsletter_status so the Telegram + newsletter pipelines pick it up
  // again. Brand-new rows (no prior id) get DB defaults; continuing-active
  // rows are left alone.
  const ids = jobs.map((j) => j.id);
  const reopenedIds = new Set<string>();
  for (const batchIds of chunk(ids, BATCH)) {
    const { data, error } = await sb
      .from("jobs")
      .select("id,active")
      .in("id", batchIds);
    if (error) throw new Error(`load prior state failed: ${error.message}`);
    for (const r of data ?? []) {
      if (r.active === false) reopenedIds.add(r.id as string);
    }
  }

  // The `first_seen_at` column defaults to now() on insert and is preserved
  // on conflict because we don't include it in the upsert payload — except
  // for reopened rows, where we explicitly bump it.
  const rows = jobs.map((j) => {
    const base = {
      id: j.id,
      company: j.company,
      title: j.title,
      location: j.location,
      url: j.url,
      posted_date: j.posted_date,
      department: j.department,
      platform: j.platform,
      category: j.category,
      active: true,
      last_seen_at: now,
      source: "scraper",
      // Only overwrite description when scraper produced one. Sending null
      // would clobber a value captured on a previous run for the same id.
      ...(j.description ? { description: j.description, skills_extracted_at: null } : {}),
    };
    if (reopenedIds.has(j.id)) {
      return {
        ...base,
        first_seen_at: now,
        telegram_sent_at: null,
        newsletter_status: null,
      };
    }
    return base;
  });

  // PostgREST derives ONE `columns=` list from the UNION of every key in the
  // array and writes NULL for any row missing one of them. supabase-js only
  // sends `Prefer: missing=default` when defaultToNull:false — which we must
  // NOT use, because it doesn't apply on the merge path and would resolve
  // first_seen_at to now() on every run, re-broadcasting the whole board.
  // `rows` has up to 4 shapes (reopened x has-description), so send each shape
  // as its own request and let each request's columns= list say exactly what
  // it intends to write.
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = Object.keys(r).sort().join(",");
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }

  let upserted = 0;
  for (const group of groups.values()) {
    for (const batch of chunk(group, BATCH)) {
      const { error } = await sb.from("jobs").upsert(batch, { onConflict: "id" });
      if (error) throw new Error(`upsert jobs failed: ${error.message}`);
      upserted += batch.length;
    }
  }
  return { upserted, reopened: reopenedIds.size };
}

/**
 * Mark scraper-sourced jobs that weren't seen in this run as active=false.
 * Manual listings (source='manual') are left alone — they expire only when
 * removed from the manual file.
 */
export async function deactivateUnseen(seenIds: string[]): Promise<{ deactivated: number }> {
  // Hard floor: an empty seen-set can only mean the scrape failed. Never let
  // that be interpreted as "every listing has closed".
  if (seenIds.length === 0) {
    throw new Error(
      "deactivateUnseen called with an empty seen set — refusing to deactivate every job",
    );
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("jobs")
    .select("id")
    .eq("active", true)
    .eq("source", "scraper");
  if (error) throw new Error(`load active failed: ${error.message}`);

  const seen = new Set(seenIds);
  const toDeactivate = (data ?? []).map((r) => r.id).filter((id) => !seen.has(id));
  if (toDeactivate.length === 0) return { deactivated: 0 };

  for (const batch of chunk(toDeactivate, BATCH)) {
    const { error: e } = await sb.from("jobs").update({ active: false }).in("id", batch);
    if (e) throw new Error(`deactivate failed: ${e.message}`);
  }
  return { deactivated: toDeactivate.length };
}
