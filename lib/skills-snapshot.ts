import { supabase } from "@/lib/supabase";

// Shared data layer for the skills snapshot. Used by both the snapshot page
// and its Open Graph image so the shared card always matches the page.

export interface RankedItem {
  name: string;
  count: number;
}

export interface SnapshotData {
  skills: RankedItem[];
  tools: RankedItem[];
  jobCount: number;
}

interface JobTagRow {
  skills: string[] | null;
  tools: string[] | null;
}

function tally(rows: JobTagRow[], field: "skills" | "tools"): RankedItem[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const value of row[field] ?? []) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Rank skills and tools across all currently-active job postings. */
export async function getSkillsSnapshot(): Promise<SnapshotData> {
  const { data } = await supabase
    .from("jobs")
    .select("skills,tools")
    .eq("active", true);

  const rows = (data ?? []) as JobTagRow[];
  return {
    skills: tally(rows, "skills"),
    tools: tally(rows, "tools"),
    jobCount: rows.length,
  };
}

/** Human-readable "Month Year" label for the current snapshot. */
export function snapshotMonth(): string {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}
