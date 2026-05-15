import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import type { Job } from "../types/job";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { JsonLd } from "../components/json-ld";
import { SITE_URL, itemListJsonLd } from "@/lib/seo";
import { JobBoard } from "./jobs-board";

export const revalidate = 21600; // 6 hours

export const metadata = {
  title: "Designer jobs in AI",
  description:
    "A daily-refreshed board of designer roles from design studios, design-led product companies, and AI-native teams. Apply directly with the company.",
  alternates: { canonical: "/jobs" },
  openGraph: {
    title: "Designer jobs in AI — DesAIgn Radar",
    description:
      "Open roles for designers exploring AI, aggregated daily from public career pages.",
    url: `${SITE_URL}/jobs`,
  },
};

export default async function JobsPage() {
  const { data, error } = await supabase
    .from("jobs")
    .select("id,company,title,location,url,posted_date,department,platform,category,active,source,first_seen_at,last_seen_at,skills,tools")
    .eq("active", true)
    .order("posted_date", { ascending: false, nullsFirst: false });

  const jobs = (data ?? []) as Job[];

  const jobsJsonLd = itemListJsonLd(
    "Designer jobs in AI — DesAIgn Radar",
    `${SITE_URL}/jobs`,
    jobs.map((j) => ({ name: `${j.title} — ${j.company}`, url: j.url })),
  );

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-zinc-950">
      <JsonLd data={jobsJsonLd} />
      <SiteHeader />

      <section className="border-b border-zinc-900/10">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:py-16">
          <span className="inline-flex rounded-full border border-brand-deep/20 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-deep">
            Designer-focused jobs
          </span>
          <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[0.95] tracking-tight text-zinc-950 sm:text-6xl lg:text-[3.7rem]">
            Open roles for designers exploring AI.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg">
            Aggregated daily from public career pages of design studios,
            design-led product companies, and AI-native teams hiring designers.
            Apply directly with the company.
          </p>
        </div>
      </section>

      {error && (
        <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            Supabase could not load jobs right now. {error.message}
          </div>
        </div>
      )}

      {!error && jobs.length === 0 && (
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-zinc-600">
            No open designer roles right now. Check back soon — the scraper
            refreshes daily.
          </div>
        </div>
      )}

      {!error && jobs.length > 0 && (
        <Suspense fallback={null}>
          <JobBoard jobs={jobs} />
        </Suspense>
      )}

      <section className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">
        <p className="rounded-lg border border-zinc-200 bg-white/60 p-5 text-xs leading-6 text-zinc-500">
          Designer-focused listings aggregated from public career pages. We
          link to original postings — apply directly with the company. To
          remove a listing,{" "}
          <a
            href="https://tally.so/r/Y5pvG5"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand-deep underline decoration-brand-deep/30 underline-offset-2 transition hover:decoration-brand-deep"
          >
            contact us
          </a>
          .
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
