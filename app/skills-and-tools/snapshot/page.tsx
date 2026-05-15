import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { getSkillsSnapshot, snapshotMonth, type RankedItem } from "@/lib/skills-snapshot";
import { SITE_URL } from "@/lib/seo";
import { CopyButton } from "./copy-button";

export const revalidate = 21600; // 6 hours

const MONTH = snapshotMonth();

export const metadata: Metadata = {
  title: `Top tools & skills designers are asked for — ${MONTH}`,
  description: `A ranked snapshot of the design tools and skills most in demand right now, counted across active designer job postings — ${MONTH}.`,
  alternates: { canonical: "/skills-and-tools/snapshot" },
  openGraph: {
    title: `Top tools & skills designers are asked for — ${MONTH}`,
    description:
      "Ranked from active designer job postings on DesAIgn Radar.",
    url: `${SITE_URL}/skills-and-tools/snapshot`,
  },
};

function RankedList({
  items,
  label,
}: {
  items: RankedItem[];
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
      <h2 className="text-2xl font-black tracking-tight text-zinc-950">
        {label}
      </h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          Not enough data yet — check back as the job board grows.
        </p>
      ) : (
        <ol className="mt-5 space-y-2">
          {items.slice(0, 10).map((item, i) => (
            <li
              key={item.name}
              className="flex items-baseline justify-between gap-3 rounded-lg border border-zinc-100 bg-zinc-50/60 px-4 py-3"
            >
              <div className="flex min-w-0 items-baseline gap-3">
                <span className="text-xl font-black tabular-nums text-brand-deep">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="truncate text-base font-semibold text-zinc-950">
                  {item.name}
                </span>
              </div>
              <span className="shrink-0 text-sm tabular-nums text-zinc-500">
                {item.count} {item.count === 1 ? "job" : "jobs"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default async function SkillsSnapshotPage() {
  const { skills, tools, jobCount } = await getSkillsSnapshot();

  // Ready-made post text for LinkedIn / Reddit / Designer News.
  const topTools = tools
    .slice(0, 10)
    .map((t, i) => `${i + 1}. ${t.name}`)
    .join("\n");
  const shareText = `Top tools designers are being asked for right now (${MONTH}):\n\n${topTools}\n\nCounted across ${jobCount} live designer job postings.\n${SITE_URL}/skills-and-tools/snapshot`;

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-zinc-950">
      <SiteHeader />

      <section className="border-b border-zinc-900/10">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 lg:py-16">
          <span className="inline-flex rounded-full border border-brand-deep/20 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-deep">
            Snapshot · {MONTH}
          </span>
          <h1 className="mt-7 max-w-3xl text-4xl font-black leading-[1] tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
            What designers are being asked for right now.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-600 sm:text-lg">
            The tools and skills most in demand, counted across{" "}
            <strong className="text-zinc-950">{jobCount}</strong> active
            designer job postings on the DesAIgn Radar board.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-14">
        <div className="grid gap-8 md:grid-cols-2">
          <RankedList items={tools} label="Tools" />
          <RankedList items={skills} label="Skills" />
        </div>

        {/* Share block */}
        <div className="mt-12 rounded-2xl bg-[#25252a] p-7 sm:p-9">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand">
            Share this snapshot
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
            One click to post the monthly ranking.
          </h2>
          <pre className="mt-5 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-4 text-sm leading-6 text-white/80">
            {shareText}
          </pre>
          <div className="mt-5">
            <CopyButton text={shareText} />
          </div>
        </div>

        <p className="mt-10 text-sm text-zinc-500">
          Want to slice this by position or time period?{" "}
          <Link
            href="/skills-and-tools"
            className="font-semibold text-brand-deep underline decoration-brand-deep/30 underline-offset-2 hover:decoration-brand-deep"
          >
            Open the interactive explorer →
          </Link>
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
