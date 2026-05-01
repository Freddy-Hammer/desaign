import { CUSTOM_SCRAPERS } from "./scrapers/custom";
import { activeCompanies } from "./companies";
import { fetchGreenhouse } from "./scrapers/greenhouse";
import { filterJob } from "./filter";

async function main() {
  console.log("--- Active companies summary ---");
  const active = activeCompanies();
  const byPlatform: Record<string, number> = {};
  for (const c of active) byPlatform[c.platform] = (byPlatform[c.platform] ?? 0) + 1;
  console.log(byPlatform);
  console.log(`Total active: ${active.length}`);

  console.log("\n--- Custom HTML scrapers ---");
  for (const [company, fetcher] of Object.entries(CUSTOM_SCRAPERS)) {
    console.log(`\n=== ${company} (custom) ===`);
    try {
      const jobs = await fetcher();
      console.log(`Total returned: ${jobs.length}`);
      for (const j of jobs.slice(0, 10)) {
        const f = filterJob(j);
        console.log(`  ${f.include ? "+" : "-"} ${j.title}  —  ${j.location}`);
      }
    } catch (err) {
      console.error(`  FAILED: ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log("\n--- IDEO via Greenhouse (newly moved) ---");
  try {
    const jobs = await fetchGreenhouse("IDEO", "ideo");
    const designy = jobs.filter((j) => filterJob(j).include);
    console.log(`Total: ${jobs.length}   Kept: ${designy.length}`);
    for (const j of designy.slice(0, 8)) {
      console.log(`  + ${j.title}  —  ${j.location}`);
    }
  } catch (err) {
    console.error(`FAILED: ${(err as Error).message}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
