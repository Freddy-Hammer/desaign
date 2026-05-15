import { supabase } from "@/lib/supabase";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { SITE_URL } from "@/lib/seo";
import { SkillsToolsExplorer, type ExplorerJob } from "./explorer";

export const revalidate = 21600; // 6 hours

export const metadata = {
  title: "Skills & tools designers are asked for",
  description:
    "A live chart of the skills and tools designers are being asked for, extracted from active job postings on the DesAIgn Radar board.",
  alternates: { canonical: "/skills-and-tools" },
  openGraph: {
    title: "Skills & tools designers are asked for — DesAIgn Radar",
    description:
      "What designers are being asked for, extracted from active job postings.",
    url: `${SITE_URL}/skills-and-tools`,
  },
};

interface JobRow {
  id: string;
  title: string;
  posted_date: string | null;
  first_seen_at: string;
  skills: string[] | null;
  tools: string[] | null;
}

export default async function SkillsAndToolsPage() {
  const { data, error } = await supabase
    .from("jobs")
    .select("id,title,posted_date,first_seen_at,skills,tools")
    .eq("active", true);

  const rows = (data ?? []) as JobRow[];
  const jobs: ExplorerJob[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    // posted_date is the company's stated date when present; first_seen_at is
    // when DesAIgn Radar discovered it. Use posted_date when available so the
    // period filter answers "what was being asked for then?" not "when did
    // we crawl it?".
    effective_date: r.posted_date ?? r.first_seen_at,
    skills: r.skills ?? [],
    tools: r.tools ?? [],
  }));

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
            Extracted from {jobs.length} active job postings on the DesAIgn
            Radar board. Filter by position and time period to see what each
            slice actually demands.
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

      {!error && <SkillsToolsExplorer jobs={jobs} />}

      <section className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">
        <p className="rounded-lg border border-zinc-200 bg-white/60 p-5 text-xs leading-6 text-zinc-500">
          Counts come from a curated keyword dictionary scanned against each
          job description. A job is counted at most once per skill or tool.
          Period filter uses the company&apos;s posted date when available, the
          date we discovered the listing otherwise.
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
