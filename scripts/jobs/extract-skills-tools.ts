/**
 * Extract skills + tools from job descriptions and write to jobs.skills,
 * jobs.tools, jobs.skills_extracted_at.
 *
 * Idempotent. By default only processes rows where skills_extracted_at IS NULL
 * OR the description was updated more recently than skills_extracted_at.
 *
 *   npx tsx scripts/jobs/extract-skills-tools.ts            # dry-run
 *   npx tsx scripts/jobs/extract-skills-tools.ts --write    # write to DB
 *   npx tsx scripts/jobs/extract-skills-tools.ts --all      # re-extract everything
 *   npx tsx scripts/jobs/extract-skills-tools.ts --write --all
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getSupabase } from "../lib/supabase-client";
import { compileDictionary, SKILLS, TOOLS } from "./dictionaries";

const WRITE = process.argv.includes("--write");
const ALL = process.argv.includes("--all");
const VERBOSE = process.argv.includes("--verbose");
const BATCH = 200;

interface JobRow {
  id: string;
  title: string;
  company: string;
  description: string | null;
}

function extractMatches(text: string, dict: [string, RegExp][]): string[] {
  const out: string[] = [];
  for (const [name, re] of dict) {
    if (re.test(text)) out.push(name);
  }
  return out;
}

async function main() {
  const sb = getSupabase();

  let query = sb
    .from("jobs")
    .select("id,title,company,description")
    .not("description", "is", null);
  if (!ALL) query = query.is("skills_extracted_at", null);

  const { data, error } = await query;
  if (error) throw new Error(`fetch jobs failed: ${error.message}`);
  const rows = (data ?? []) as JobRow[];

  if (rows.length === 0) {
    console.log("No jobs need extraction. (Pass --all to re-extract everything.)");
    return;
  }

  console.log(`Processing ${rows.length} job(s)... mode=${WRITE ? "WRITE" : "dry-run"}\n`);

  const skillsDict = compileDictionary(SKILLS);
  const toolsDict = compileDictionary(TOOLS);

  const updates: { id: string; skills: string[]; tools: string[] }[] = [];

  for (const j of rows) {
    if (!j.description) continue;
    const skills = extractMatches(j.description, skillsDict);
    const tools = extractMatches(j.description, toolsDict);
    updates.push({ id: j.id, skills, tools });
    if (VERBOSE || !WRITE) {
      console.log(
        `  ${j.company.padEnd(20).slice(0, 20)} ${j.title.slice(0, 50).padEnd(50)} ` +
          `skills=${skills.length} tools=${tools.length}`,
      );
    }
  }

  // Aggregate summary so dry-run shows what the chart would render.
  const skillTotals = new Map<string, number>();
  const toolTotals = new Map<string, number>();
  for (const u of updates) {
    for (const s of u.skills) skillTotals.set(s, (skillTotals.get(s) ?? 0) + 1);
    for (const t of u.tools) toolTotals.set(t, (toolTotals.get(t) ?? 0) + 1);
  }
  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

  console.log("\n=== Top skills ===");
  for (const [k, v] of top(skillTotals, 10)) console.log(`  ${String(v).padStart(3)}  ${k}`);
  console.log("\n=== Top tools ===");
  for (const [k, v] of top(toolTotals, 10)) console.log(`  ${String(v).padStart(3)}  ${k}`);

  if (!WRITE) {
    console.log("\n(dry-run — pass --write to update jobs)");
    return;
  }

  const now = new Date().toISOString();
  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    // Supabase has no batch update by id without upsert; loop in parallel chunks.
    await Promise.all(
      batch.map(async (u) => {
        const { error: e } = await sb
          .from("jobs")
          .update({ skills: u.skills, tools: u.tools, skills_extracted_at: now })
          .eq("id", u.id);
        if (e) throw new Error(`update ${u.id} failed: ${e.message}`);
      }),
    );
    written += batch.length;
    console.log(`  wrote ${written}/${updates.length}`);
  }

  console.log(`\nDone. Updated ${written} jobs.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
