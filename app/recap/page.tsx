import Link from "next/link";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import type { Issue } from "../types/issue";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "The Recap — every issue",
  description:
    "Every issue of the DesAIgn Radar weekly recap — the design + AI signals worth your attention, edited tight.",
  alternates: { canonical: "/recap" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function excerpt(text: string | null, max = 180): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max).trimEnd() + "…" : clean;
}

export default async function RecapIndexPage() {
  const { data } = await supabase
    .from("issues")
    .select("id,number,slug,title,intro,published_at,created_at")
    .order("published_at", { ascending: false });

  const issues = (data ?? []) as Issue[];

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-zinc-950">
      <SiteHeader />

      <section className="border-b border-zinc-900/10">
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 lg:py-16">
          <span className="inline-flex rounded-full border border-brand-deep/20 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-deep">
            The Recap
          </span>
          <h1 className="mt-7 text-4xl font-black leading-[1] tracking-tight text-zinc-950 sm:text-5xl">
            Every issue, in one place.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-zinc-600 sm:text-lg">
            The web archive of the DesAIgn Radar newsletter — each issue&apos;s
            design + AI signals, edited tight.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        {issues.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-zinc-600">
            No issues published yet — the first recap lands soon.
          </div>
        ) : (
          <ul className="space-y-5">
            {issues.map((issue) => (
              <li key={issue.id}>
                <Link
                  href={`/recap/${issue.slug}`}
                  className="group block rounded-2xl border border-zinc-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-8"
                >
                  <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                    <span className="text-brand-deep">
                      Issue {String(issue.number).padStart(2, "0")}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(issue.published_at)}</span>
                  </div>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-zinc-950 transition group-hover:text-brand-dark sm:text-3xl">
                    {issue.title}
                  </h2>
                  {issue.intro && (
                    <p className="mt-3 text-base leading-7 text-zinc-600">
                      {excerpt(issue.intro)}
                    </p>
                  )}
                  <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-zinc-950 transition group-hover:gap-2.5">
                    Read the issue
                    <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
