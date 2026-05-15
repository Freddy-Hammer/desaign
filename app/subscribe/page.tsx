import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Post } from "../types/post";
import { SignalCard } from "../components/signal-card";
import { SubscribeForm } from "../components/subscribe-form";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";

export const revalidate = 0;

export const metadata = {
  title: "Subscribe",
  description:
    "A short dispatch of curated design + AI work — videos, launches, essays, studio notes — direct in your inbox.",
  alternates: { canonical: "/subscribe" },
};

const ISSUE_INGREDIENTS = [
  {
    label: "Videos",
    desc: "Talks, tutorials, and case studies — only the few worth your evening.",
  },
  {
    label: "Studios",
    desc: "Launches, identity systems, and design notes from working studios.",
  },
  {
    label: "Essays",
    desc: "Long reads on craft, tools, and the shape of designing with AI.",
  },
  {
    label: "Tools",
    desc: "New software for designers using AI — when there's a real reason to look.",
  },
  {
    label: "Images",
    desc: "Strange, beautiful, or both — visual experiments from the edge.",
  },
  {
    label: "Memes",
    desc: "When something earns its place. Curation, not noise.",
  },
];

export default async function SubscribePage() {
  const { data } = await supabase
    .from("posts")
    .select("id,title,link,source,category,thumbnail_url,created_at")
    .order("created_at", { ascending: false })
    .limit(6);

  const recent = (data ?? []) as Post[];

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-zinc-950">
      <SiteHeader />

      {/* Hero */}
      <section
        id="subscribe"
        className="scroll-mt-24 border-b border-zinc-900/10"
      >
        <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8 sm:py-28">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-dark">
            The DesAIgn newsletter
          </p>
          <h1 className="mt-5 text-4xl font-black leading-[1] tracking-tight text-zinc-950 sm:text-6xl lg:text-[4.2rem]">
            Useful signals for designers working with AI &mdash; direct in your
            inbox.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-zinc-600 sm:text-lg sm:leading-8">
            A short dispatch of curated design + AI work — videos, launches,
            essays, studio notes — delivered when there&apos;s something worth
            your attention. No filler.
          </p>
          <div className="mt-10">
            <SubscribeForm />
          </div>
          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
            Free · no spam · unsubscribe anytime
          </p>
          <p className="mx-auto mt-3 max-w-md text-[11px] leading-5 text-zinc-500">
            By subscribing you agree to our{" "}
            <Link
              href="/privacy"
              className="font-semibold text-brand-deep underline decoration-brand-deep/30 underline-offset-2 hover:decoration-brand-deep"
            >
              Privacy Policy
            </Link>
            . Your email is sent to Beehiiv, our newsletter provider.
          </p>
        </div>
      </section>

      {/* Inside each issue */}
      <section className="border-b border-zinc-900/10 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-20 sm:px-8 sm:py-24">
          <div className="mb-14 max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-dark">
              Inside each issue
            </p>
            <h2 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight text-zinc-950 sm:text-4xl">
              Six small sections, edited tight.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">
              External links stay with their original creators. DesAIgn adds the
              discovery, the context, and the rhythm.
            </p>
          </div>
          <ul className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {ISSUE_INGREDIENTS.map((it, i) => (
              <li key={it.label} className="flex gap-5">
                <span
                  aria-hidden="true"
                  className="select-none text-3xl font-black tabular-nums leading-none tracking-tighter text-zinc-300 sm:text-4xl"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-lg font-black tracking-tight text-zinc-950">
                    {it.label}
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-zinc-600">
                    {it.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pull quote */}
      <section className="border-b border-zinc-900/10">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8 sm:py-24">
          <span
            aria-hidden="true"
            className="block text-5xl font-black leading-none text-brand sm:text-6xl"
          >
            &ldquo;
          </span>
          <blockquote className="mt-4 text-2xl font-bold leading-snug tracking-tight text-zinc-800 sm:text-3xl">
            Signals worth opening before the feed moves on.
          </blockquote>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
            The DesAIgn promise
          </p>
        </div>
      </section>

      {/* Recent issues preview */}
      {recent.length > 0 && (
        <section className="border-b border-zinc-900/10">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="mb-10 flex items-end justify-between gap-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand-dark">
                  Recent finds
                </p>
                <h2 className="mt-2 text-3xl font-black leading-[1.05] tracking-tight text-zinc-950 sm:text-4xl">
                  A taste of what subscribers got.
                </h2>
              </div>
              <Link
                href="/"
                className="hidden text-xs font-bold uppercase tracking-[0.2em] text-zinc-700 underline underline-offset-4 transition hover:text-zinc-950 md:inline"
              >
                Browse the archive →
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {recent.map((post) => (
                <SignalCard key={post.id} post={post} />
              ))}
            </div>
            <div className="mt-10 flex justify-center md:hidden">
              <Link
                href="/"
                className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-800 transition hover:border-zinc-500 hover:text-zinc-950"
              >
                Browse the archive →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="bg-[#25252a] text-white">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8 sm:py-24">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand">
            One more thing
          </p>
          <h2 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
            Get the next signal in your inbox.
          </h2>
          <a
            href="#subscribe"
            className="mt-10 inline-flex rounded-full bg-white px-7 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-zinc-950 transition hover:bg-brand hover:text-white"
          >
            Subscribe ↑
          </a>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
