import { getSupabase } from "./supabase-client";

export interface DedupInput {
  source_url: string;
  source_id: string;
}

/**
 * Returns the set of source_urls already present in raw_items.
 * Checks both source_url and source_id so either match counts as a duplicate.
 */
const BATCH_SIZE = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function findExisting(
  candidates: DedupInput[]
): Promise<Set<string>> {
  if (candidates.length === 0) return new Set();

  const urls = candidates.map((c) => c.source_url);
  const ids = candidates.map((c) => c.source_id);

  const sb = getSupabase();
  const existing = new Set<string>();

  for (const batch of chunk(urls, BATCH_SIZE)) {
    const { data, error } = await sb
      .from("raw_items")
      .select("source_url")
      .in("source_url", batch);
    if (error) throw new Error(`Dedup query failed: ${error.message}`);
    for (const row of data ?? []) if (row.source_url) existing.add(row.source_url);
  }

  for (const batch of chunk(ids, BATCH_SIZE)) {
    const { data, error } = await sb
      .from("raw_items")
      .select("source_url, source_id")
      .in("source_id", batch);
    if (error) throw new Error(`Dedup query failed: ${error.message}`);
    for (const row of data ?? []) if (row.source_url) existing.add(row.source_url);
  }

  return existing;
}
