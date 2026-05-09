import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Job } from "../types/job";
import { JobCard } from "./job-card";

export async function JobsStrip() {
  const [{ data: latest }, { count }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id,company,title,location,url,posted_date,department,platform,category,active,source,first_seen_at,last_seen_at,skills,tools")
      .eq("active", true)
      .order("posted_date", { ascending: false, nullsFirst: false })
      .limit(3),
    supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
  ]);

  const jobs = (latest ?? []) as Job[];
  if (jobs.length === 0) return null;

  return (
    <section className="border-b border-zinc-900/10 bg-white/45">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-deep">
              Open roles
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl">
              Designer-focused jobs, refreshed daily
            </h2>
          </div>
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-[0.2em] text-zinc-800 transition hover:border-zinc-500 hover:text-zinc-950"
          >
            See all {count ?? jobs.length} open roles
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      </div>
    </section>
  );
}
