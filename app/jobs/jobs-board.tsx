"use client";

import { useEffect, useMemo, useState } from "react";
import type { Job, JobCategory } from "../types/job";

const CATEGORIES: (JobCategory | "All")[] = [
  "All",
  "Design",
  "Brand",
  "Motion",
  "Design Eng",
  "AI/Creative",
];
const PAGE_SIZE = 24;

function isRemote(location: string | null): boolean {
  if (!location) return false;
  return /\bremote\b|\bworldwide\b|\banywhere\b/i.test(location);
}

function formatPosted(iso: string | null): string {
  if (!iso) return "Recently posted";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently posted";
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "1 week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "1 month ago";
  return `${Math.floor(days / 30)} months ago`;
}

export function JobBoard({ jobs }: { jobs: Job[] }) {
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeCategory, remoteOnly, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => {
      if (activeCategory !== "All" && j.category !== activeCategory) return false;
      if (remoteOnly && !isRemote(j.location)) return false;
      if (q) {
        const blob = `${j.title} ${j.company}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [jobs, activeCategory, remoteOnly, query]);

  const visible = filtered.slice(0, visibleCount);

  // Per-category counts for the chip labels — based on remote+query filters,
  // so the chip count reflects what would actually appear if you clicked it.
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: 0 };
    for (const c of CATEGORIES) counts[c] = 0;
    const q = query.trim().toLowerCase();
    for (const j of jobs) {
      if (remoteOnly && !isRemote(j.location)) continue;
      if (q) {
        const blob = `${j.title} ${j.company}`.toLowerCase();
        if (!blob.includes(q)) continue;
      }
      counts.All++;
      counts[j.category] = (counts[j.category] ?? 0) + 1;
    }
    return counts;
  }, [jobs, remoteOnly, query]);

  const pillBase =
    "rounded-full border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] transition cursor-pointer select-none";
  const pillInactive =
    "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900";
  const pillActive = "border-brand bg-brand text-white";

  return (
    <section className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8">
      <div className="mb-8 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`${pillBase} ${activeCategory === c ? pillActive : pillInactive} flex items-center gap-2`}
            >
              {c}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  activeCategory === c ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {categoryCounts[c] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-700 transition hover:border-zinc-400">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-brand-deep"
            />
            Remote only
          </label>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or company"
            className="flex-1 min-w-[200px] rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-brand-deep focus:outline-none"
          />
        </div>

        <p className="text-xs font-medium text-zinc-500">
          {filtered.length} {filtered.length === 1 ? "role" : "roles"}
        </p>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-zinc-600">
            No jobs match these filters.
          </p>
          <button
            onClick={() => {
              setActiveCategory("All");
              setRemoteOnly(false);
              setQuery("");
            }}
            className="mt-4 rounded-full border border-zinc-300 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950"
          >
            Clear filters
          </button>
        </div>
      )}

      {filtered.length > 0 && (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>

          {visibleCount < filtered.length && (
            <div className="mt-12 flex flex-col items-center gap-3">
              <button
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="rounded-full border border-zinc-300 bg-white px-7 py-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-800 transition hover:border-zinc-500 hover:text-zinc-950"
              >
                Load more
              </button>
              <p className="text-xs font-medium text-zinc-500">
                Showing {visible.length} of {filtered.length}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function JobCard({ job }: { job: Job }) {
  const remote = isRemote(job.location);
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noreferrer"
      className="group flex h-full flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-deep">
          {job.company}
        </span>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-700">
          {job.category}
        </span>
      </div>

      <h3 className="line-clamp-3 text-xl font-black leading-tight tracking-tight text-zinc-950 transition group-hover:text-brand-dark">
        {job.title}
      </h3>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">
        <div className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          <span className="line-clamp-1">{job.location || "Location TBD"}</span>
          <span className="flex items-center gap-2">
            {remote && (
              <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[9px] font-bold tracking-[0.18em] text-brand-deep">
                Remote
              </span>
            )}
            <span className="text-zinc-400 normal-case tracking-normal">
              {formatPosted(job.posted_date)}
            </span>
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.2em] text-zinc-950 transition group-hover:gap-2 group-hover:text-brand-dark">
          Apply
          <span aria-hidden="true">↗</span>
        </span>
      </div>
    </a>
  );
}
