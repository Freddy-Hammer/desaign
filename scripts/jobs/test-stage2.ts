import { fetchLever } from "./scrapers/lever";
import { fetchAshby } from "./scrapers/ashby";
import type { Job, JobCategory } from "./schema";

const LEVER_TARGETS = [
  { company: "Spotify", slug: "spotify" },
  { company: "Frog Design", slug: "frog" },
];

const ASHBY_TARGETS = [
  { company: "Linear", slug: "linear" },
  { company: "Cursor", slug: "cursor" },
  { company: "OpenAI", slug: "openai" },
  { company: "Notion", slug: "Notion" },
  { company: "Browser Company", slug: "The Browser Company" },
  { company: "Framer", slug: "framer" }, // marked skip in companies.ts but worth probing
];

function tally(jobs: Job[]): Record<JobCategory, number> {
  const t: Record<string, number> = {};
  for (const j of jobs) t[j.category] = (t[j.category] ?? 0) + 1;
  return t as Record<JobCategory, number>;
}

function preview(label: string, jobs: Job[]) {
  console.log(`Total: ${jobs.length}   Breakdown:`, tally(jobs));
  const designy = jobs.filter((j) => j.category !== "Other");
  console.log(`  Designer-relevant (${designy.length}):`);
  for (const j of designy.slice(0, 10)) {
    console.log(
      `    [${j.category.padEnd(11)}] ${j.title}  —  ${j.location || "—"}  (${j.department ?? "—"})`
    );
  }
  if (designy.length > 10) console.log(`    ...and ${designy.length - 10} more`);
}

async function runOne<T extends { company: string; slug: string }>(
  label: string,
  target: T,
  fetcher: (c: string, s: string) => Promise<Job[]>
) {
  console.log(`\n=== ${target.company} (${label}:${target.slug}) ===`);
  try {
    const jobs = await fetcher(target.company, target.slug);
    preview(label, jobs);
  } catch (err) {
    console.error(`  FAILED: ${(err as Error).message}`);
  }
}

async function main() {
  console.log("--- Lever ---");
  for (const t of LEVER_TARGETS) {
    await runOne("lever", t, fetchLever);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("\n\n--- Ashby ---");
  for (const t of ASHBY_TARGETS) {
    await runOne("ashby", t, fetchAshby);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
