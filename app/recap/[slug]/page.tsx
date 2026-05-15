import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Issue } from "../../types/issue";
import type { Post } from "../../types/post";
import { SignalCard } from "../../components/signal-card";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { JsonLd } from "../../components/json-ld";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

export const revalidate = 0;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function introExcerpt(text: string | null, max = 180): string {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max).trimEnd() + "…" : clean;
}

async function getIssue(slug: string): Promise<Issue | null> {
  const { data } = await supabase
    .from("issues")
    .select("id,number,slug,title,intro,published_at,created_at")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Issue) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const issue = await getIssue(slug);
  if (!issue) return { title: "Issue not found" };

  const description =
    introExcerpt(issue.intro) ||
    `Issue ${issue.number} of the DesAIgn Radar recap.`;
  return {
    title: issue.title,
    description,
    alternates: { canonical: `/recap/${issue.slug}` },
    openGraph: {
      type: "article",
      title: issue.title,
      description,
      url: `${SITE_URL}/recap/${issue.slug}`,
      publishedTime: issue.published_at,
    },
  };
}

export default async function IssuePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const issue = await getIssue(slug);
  if (!issue) notFound();

  const { data: postData } = await supabase
    .from("posts")
    .select("id,title,link,source,category,thumbnail_url,created_at")
    .eq("issue_id", issue.id)
    .order("created_at", { ascending: false });

  const posts = (postData ?? []) as Post[];

  // Split the editorial intro into paragraphs on blank lines.
  const introParagraphs = (issue.intro ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: issue.title,
    datePublished: issue.published_at,
    url: `${SITE_URL}/recap/${issue.slug}`,
    description: introExcerpt(issue.intro),
    author: { "@type": "Organization", name: SITE_NAME },
    publisher: { "@id": `${SITE_URL}/#organization` },
    isPartOf: { "@id": `${SITE_URL}/#website` },
  };

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-zinc-950">
      <JsonLd data={articleJsonLd} />
      <SiteHeader />

      <section className="border-b border-zinc-900/10">
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 lg:py-16">
          <Link
            href="/recap"
            className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500 transition hover:text-brand-deep"
          >
            ← The Recap
          </Link>
          <div className="mt-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            <span className="text-brand-deep">
              Issue {String(issue.number).padStart(2, "0")}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatDate(issue.published_at)}</span>
          </div>
          <h1 className="mt-4 text-4xl font-black leading-[1.02] tracking-tight text-zinc-950 sm:text-5xl">
            {issue.title}
          </h1>

          {introParagraphs.length > 0 && (
            <div className="mt-7 space-y-4 text-lg leading-8 text-zinc-700">
              {introParagraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        {posts.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-zinc-600">
            This issue has no linked signals yet.
          </div>
        ) : (
          <>
            <p className="mb-8 text-xs font-bold uppercase tracking-[0.22em] text-brand-dark">
              In this issue
            </p>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {posts.map((post) => (
                <SignalCard key={post.id} post={post} />
              ))}
            </div>
          </>
        )}

        <div className="mt-14 rounded-2xl bg-[#25252a] p-7 text-center sm:p-9">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-brand">
            Get the next issue
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Don&apos;t wait for the recap.
          </h2>
          <Link
            href="/subscribe"
            className="mt-6 inline-flex rounded-full bg-white px-7 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-zinc-950 transition hover:bg-brand hover:text-white"
          >
            Subscribe →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
