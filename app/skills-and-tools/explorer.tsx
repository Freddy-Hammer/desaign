"use client";

import { useMemo, useState } from "react";
import { HorizontalBarChart, type BarDatum } from "./charts";
import { positionsForTitle, POSITIONS } from "@/lib/positions";

export interface ExplorerJob {
  id: string;
  title: string;
  // ISO 8601 string. Pre-resolved on the server: posted_date ?? first_seen_at.
  effective_date: string;
  skills: string[];
  tools: string[];
}

type PeriodPreset = "all" | "7d" | "30d" | "90d" | "custom";

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  all: "All time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  custom: "Custom",
};

function tally(jobs: ExplorerJob[], field: "skills" | "tools"): BarDatum[] {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    for (const v of j[field] ?? []) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function periodCutoff(period: PeriodPreset): Date | null {
  if (period === "all" || period === "custom") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function TopThree({ items, label }: { items: BarDatum[]; label: string }) {
  const top = items.slice(0, 3);
  return (
    <div>
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
        Top 3 {label}
      </div>
      {top.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white/60 p-4 text-sm text-zinc-500">
          No matches in this slice.
        </div>
      ) : (
        <ol className="space-y-2">
          {top.map((t, i) => (
            <li
              key={t.name}
              className="flex items-baseline justify-between gap-3 rounded-lg border border-zinc-200 bg-white/70 px-4 py-3"
            >
              <div className="flex min-w-0 items-baseline gap-3">
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

const PERIOD_ORDER: PeriodPreset[] = ["all", "7d", "30d", "90d", "custom"];

export function SkillsToolsExplorer({ jobs }: { jobs: ExplorerJob[] }) {
  const [position, setPosition] = useState<string>("all");
  const [period, setPeriod] = useState<PeriodPreset>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  // Compute job → positions[] once. Memoize on jobs identity (server-stable).
  const jobsWithPositions = useMemo(
    () =>
      jobs.map((j) => ({
        ...j,
        positions: positionsForTitle(j.title),
      })),
    [jobs],
  );

  // Position counts for the dropdown — only positions that exist in current data.
  const positionOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of jobsWithPositions) {
      for (const p of j.positions) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return POSITIONS.map((p) => p.name)
      .filter((n) => counts.has(n))
      .map((n) => ({ name: n, count: counts.get(n) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [jobsWithPositions]);

  const filteredJobs = useMemo(() => {
    let out = jobsWithPositions;

    if (position !== "all") {
      out = out.filter((j) => j.positions.includes(position));
    }

    if (period !== "all") {
      let from: Date | null = null;
      let to: Date | null = null;
      if (period === "custom") {
        if (customFrom) from = new Date(customFrom + "T00:00:00");
        if (customTo) to = new Date(customTo + "T23:59:59");
      } else {
        from = periodCutoff(period);
      }
      out = out.filter((j) => {
        const t = new Date(j.effective_date).getTime();
        if (from && t < from.getTime()) return false;
        if (to && t > to.getTime()) return false;
        return true;
      });
    }

    return out;
  }, [jobsWithPositions, position, period, customFrom, customTo]);

  const skills = useMemo(() => tally(filteredJobs, "skills"), [filteredJobs]);
  const tools = useMemo(() => tally(filteredJobs, "tools"), [filteredJobs]);

  const taggedJobs = filteredJobs.filter(
    (j) => j.skills.length + j.tools.length > 0,
  ).length;

  return (
    <>
      {/* Filter bar */}
      <section className="mx-auto max-w-7xl px-5 pt-10 sm:px-8">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="position-filter"
                className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500"
              >
                Position
              </label>
              <select
                id="position-filter"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="min-w-[14rem] rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-brand-deep focus:outline-none"
              >
                <option value="all">All positions ({jobsWithPositions.length})</option>
                {positionOptions.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                Period
              </span>
              <div className="flex flex-wrap gap-2">
                {PERIOD_ORDER.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                      period === p
                        ? "border-brand-deep bg-brand-deep text-white"
                        : "border-zinc-300 bg-white text-zinc-700 hover:border-brand-deep/60 hover:text-brand-deep"
                    }`}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {period === "custom" && (
            <div className="mt-5 flex flex-wrap items-end gap-4 border-t border-zinc-200 pt-5">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="from-date"
                  className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500"
                >
                  From
                </label>
                <input
                  id="from-date"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-brand-deep focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="to-date"
                  className="text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500"
                >
                  To
                </label>
                <input
                  id="to-date"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-brand-deep focus:outline-none"
                />
              </div>
              {(customFrom || customTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomFrom("");
                    setCustomTo("");
                  }}
                  className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 underline-offset-4 hover:text-brand-deep hover:underline"
                >
                  Clear dates
                </button>
              )}
            </div>
          )}

          <p className="mt-5 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
            Showing <span className="font-semibold text-zinc-950">{filteredJobs.length}</span>{" "}
            of {jobsWithPositions.length} active jobs.
            {taggedJobs < filteredJobs.length && (
              <> ({taggedJobs} have at least one extracted skill or tool.)</>
            )}
          </p>
        </div>
      </section>

      {/* Top 3 */}
      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="grid gap-8 md:grid-cols-2">
          <TopThree items={skills} label="skills" />
          <TopThree items={tools} label="tools" />
        </div>
      </section>

      {/* Charts */}
      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-black tracking-tight text-zinc-950">Skills</h2>
            <p className="mt-2 text-sm text-zinc-500">
              {filteredJobs.length} job{filteredJobs.length === 1 ? "" : "s"} in this slice. Bars
              show how many mention each skill.
            </p>
            <div className="mt-6">
              <HorizontalBarChart
                data={skills}
                totalJobs={filteredJobs.length}
                emptyLabel="No skill matches in this slice."
              />
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
            <h2 className="text-2xl font-black tracking-tight text-zinc-950">Tools</h2>
            <p className="mt-2 text-sm text-zinc-500">
              {filteredJobs.length} job{filteredJobs.length === 1 ? "" : "s"} in this slice. Bars
              show how many mention each tool.
            </p>
            <div className="mt-6">
              <HorizontalBarChart
                data={tools}
                totalJobs={filteredJobs.length}
                emptyLabel="No tool matches in this slice."
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
