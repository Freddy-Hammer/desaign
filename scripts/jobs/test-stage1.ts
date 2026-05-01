import { fetchGreenhouse } from "./scrapers/greenhouse";
import type { Job, JobCategory } from "./schema";

const TARGETS: { company: string; slug: string }[] = [
  { company: "Figma", slug: "figma" },
  { company: "Anthropic", slug: "anthropic" },
  { company: "Airbnb", slug: "airbnb" },
];

function countByCategory(jobs: Job[]): Record<JobCategory, number> {
  const tally: Record<string, number> = {};
  for (const j of jobs) tally[j.category] = (tally[j.category] ?? 0) + 1;
  return tally as Record<JobCategory, number>;
}

async function main() {
  for (const t of TARGETS) {
    console.log(`\n=== ${t.company} (greenhouse:${t.slug}) ===`);
    try {
      const jobs = await fetchGreenhouse(t.company, t.slug);
      const tally = countByCategory(jobs);
      console.log(`Total: ${jobs.length}   Breakdown:`, tally);

      const designy = jobs.filter((j) => j.category !== "Other");
      console.log(`\n  Designer-relevant (${designy.length}):`);
      for (const j of designy.slice(0, 12)) {
        console.log(
          `    [${j.category.padEnd(11)}] ${j.title}  —  ${j.location || "—"}`
        );
      }
      if (designy.length > 12) console.log(`    ...and ${designy.length - 12} more`);

      console.log(`\n  Sample "Other" rejects (should be non-design):`);
      for (const j of jobs.filter((j) => j.category === "Other").slice(0, 4)) {
        console.log(`    [Other      ] ${j.title}`);
      }
    } catch (err) {
      console.error(`  FAILED: ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
