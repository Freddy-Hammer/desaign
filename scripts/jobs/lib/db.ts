import { getSupabase } from "../../lib/supabase-client";
import type { Job } from "../schema";

const BATCH = 200;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function upsertJobs(jobs: Job[]): Promise<{ upserted: number }> {
  if (jobs.length === 0) return { upserted: 0 };
  const sb = getSupabase();
  const now = new Date().toISOString();

  // The `first_seen_at` column defaults to now() on insert and is preserved
  // on conflict because we don't include it in the upsert payload.
  const rows = jobs.map((j) => ({
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
  }));

  let upserted = 0;
  for (const batch of chunk(rows, BATCH)) {
    const { error } = await sb.from("jobs").upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`upsert jobs failed: ${error.message}`);
    upserted += batch.length;
  }
  return { upserted };
}

/**
 * Mark scraper-sourced jobs that weren't seen in this run as active=false.
 * Manual listings (source='manual') are left alone — they expire only when
 * removed from the manual file.
 */
export async function deactivateUnseen(seenIds: string[]): Promise<{ deactivated: number }> {
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
