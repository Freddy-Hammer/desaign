import type { Job } from "../types/job";
import { formatPosted, isRemote } from "../lib/job-format";

export function JobCard({ job }: { job: Job }) {
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
