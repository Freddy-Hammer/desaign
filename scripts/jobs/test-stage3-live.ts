import { fetchGreenhouse } from "./scrapers/greenhouse";
import { fetchAshby } from "./scrapers/ashby";
import { fetchLever } from "./scrapers/lever";
import { filterJob } from "./filter";

async function checkSource(label: string, fetch: () => Promise<{ title: string; department: string | null; location: string }[]>) {
  console.log(`\n=== ${label} ===`);
  const jobs = await fetch();
  const kept: typeof jobs = [];
  const dropped: { title: string; reason: string }[] = [];
  for (const j of jobs) {
    const r = filterJob(j);
    if (r.include) kept.push(j);
    else dropped.push({ title: j.title, reason: r.reason });
  }
  console.log(`Total: ${jobs.length}   Kept: ${kept.length}   Dropped: ${dropped.length}`);
  console.log(`  Kept:`);
  for (const j of kept.slice(0, 12)) {
    console.log(`    + ${j.title}  —  ${j.location || "—"}`);
  }
  if (kept.length > 12) console.log(`    ...and ${kept.length - 12} more`);
}

async function main() {
  await checkSource("Anthropic (greenhouse)", () => fetchGreenhouse("Anthropic", "anthropic"));
  await new Promise((r) => setTimeout(r, 1000));
  await checkSource("Spotify (lever)", () => fetchLever("Spotify", "spotify"));
  await new Promise((r) => setTimeout(r, 1000));
  await checkSource("OpenAI (ashby)", () => fetchAshby("OpenAI", "openai"));
}

main().catch((e) => { console.error(e); process.exit(1); });
