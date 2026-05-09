import { supabase } from "@/lib/supabase";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { HorizontalBarChart, type BarDatum } from "./charts";

export const revalidate = 21600; // 6 hours

interface JobRow {
  id: string;
  skills: string[] | null;
  tools: string[] | null;
}

function tally(rows: JobRow[], field: "skills" | "tools"): BarDatum[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const v of r[field] ?? []) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function TopThree({ items, label }: { items: BarDatum[]; label: string }) {
  const top = items.slice(0, 3);
  return (
    <div>
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
        Top 3 {label}
      </div>
      {top.length === 0 ? (
        <div className="text-sm text-zinc-500">Not enough data yet.</div>
      ) : (
        <ol className="space-y-2">
          {top.map((t, i) => (
            <li
              key={t.name}
              className="flex items-baseline justify-between gap-3 rounded-lg border border-zinc-200 bg-white/70 px-4 py-3"
            >
              <div className="flex items-baseline gap-3 min-w-0">
                <span className="text-2xl font-black tabular-nums text-brand-deep">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="truncate text-base font-semibold text-zinc-950">
                  {t.name}
                </span>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-zinc-500">
                {t.count} {t.count === 1 ? "job" : "jobs"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default async function SkillsAndToolsPage() {
  const { data, error } = await supabase
    .from("jobs")
    .select("id,skills,tools")
    .eq("active", true);

  const rows = (data ?? []) as JobRow[];
  const skills = tally(rows, "skills");
  const tools = tally(rows, "tools");
  const taggedJobs = rows.filter((r) => (r.skills?.length ?? 0) + (r.tools?.length ?? 0) > 0).length;

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-zinc-950">
      <SiteHeader />

      <section className="border-b border-zinc-900/10">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:py-16">
          <span className="inline-flex rounded-full border border-brand-deep/20 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-deep">
            Skills &amp; tools chart
          </span>
          <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[0.95] tracking-tight text-zinc-950 sm:text-6xl lg:text-[3.7rem]">
            What designers are being asked for.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg">
            Extracted from {taggedJobs} active job postings on the DesAIgn
            Radar board. Skills are mindset and craft signals; tools are
            named software and frameworks.
          </p>
        </div>
      </section>

      {error && (
        <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            Could not load jobs: {error.message}
          </div>
        </div>
      )}

      {!error && (
        <>
          <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
            <div className="grid gap-8 md:grid-cols-2">
              <TopThree items={skills} label="skills" />
              <TopThree items={tools} label="tools" />
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
            <div className="grid gap-10 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
                <h2 className="text-2xl font-black tracking-tight text-zinc-950">
                  Skills
                </h2>
                <p className="mt-2 text-sm text-zinc-500">
                  Across {taggedJobs} active jobs. Bars show how many postings
                  mention each skill.
                </p>
                <div className="mt-6">
                  <HorizontalBarChart
                    data={skills}
                    totalJobs={taggedJobs}
                    emptyLabel="No skill matches yet — descriptions may still be backfilling."
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
                <h2 className="text-2xl font-black tracking-tight text-zinc-950">
                  Tools
                </h2>
                <p className="mt-2 text-sm text-zinc-500">
                  Across {taggedJobs} active jobs. Bars show how many postings
                  mention each tool.
                </p>
                <div className="mt-6">
                  <HorizontalBarChart
                    data={tools}
                    totalJobs={taggedJobs}
                    emptyLabel="No tool matches yet — descriptions may still be backfilling."
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">
            <p className="rounded-lg border border-zinc-200 bg-white/60 p-5 text-xs leading-6 text-zinc-500">
              Counts are derived from a curated keyword dictionary scanned
              against each job description. A job is counted at most once per
              skill or tool. Filters by role and time period are coming next.
            </p>
          </section>
        </>
      )}

      <SiteFooter />
    </main>
  );
}
