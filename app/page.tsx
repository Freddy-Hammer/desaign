import { supabase } from "@/lib/supabase";
import type { Post } from "./types/post";
import { PostImage, getSourceTone, formatDate, isImageFirstPost } from "./components/signal-card";
import { FilterableGallery } from "./components/filterable-gallery";
import { JobsStrip } from "./components/jobs-strip";
import { SiteHeader } from "./components/site-header";
import { SiteFooter } from "./components/site-footer";
import { JsonLd } from "./components/json-ld";
import { SITE_URL, itemListJsonLd } from "@/lib/seo";

export const revalidate = 0;

function classifyPostType(post: Post): "video" | "image" | "article" {
  const src = post.source?.toLowerCase() ?? "";
  if (src.includes("youtube")) return "video";
  if (isImageFirstPost(post)) return "image";
  return "article";
}

// Within each calendar-day group, interleave by type: video → article → image → repeat.
// Keeps fresh batches diverse without shuffling the entire history.
function diversifyOrder(posts: Post[]): Post[] {
  const byDay = new Map<string, Post[]>();
  for (const p of posts) {
    const day = p.created_at?.slice(0, 10) ?? "unknown";
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(p);
  }
  const result: Post[] = [];
  for (const dayPosts of byDay.values()) {
    const videos = dayPosts.filter((p) => classifyPostType(p) === "video");
    const articles = dayPosts.filter((p) => classifyPostType(p) === "article");
    const images = dayPosts.filter((p) => classifyPostType(p) === "image");
    const max = Math.max(videos.length, articles.length, images.length);
    for (let i = 0; i < max; i++) {
      if (i < videos.length) result.push(videos[i]);
      if (i < articles.length) result.push(articles[i]);
      if (i < images.length) result.push(images[i]);
    }
  }
  return result;
}

export default async function Home() {
  const { data, error } = await supabase
    .from("posts")
    .select("id,title,link,source,category,thumbnail_url,created_at")
    .order("created_at", { ascending: false });

  const posts = diversifyOrder((data ?? []) as Post[]);
  const featuredPost = posts[0] ?? null;

  // List the curated feed as structured data so search engines and AI
  // assistants can read what DesAIgn Radar currently surfaces, each item
  // attributed to its original creator's URL.
  const feedJsonLd = itemListJsonLd(
    "DesAIgn Radar — curated design + AI feed",
    SITE_URL,
    posts.slice(0, 30).map((p) => ({ name: p.title, url: p.link })),
  );

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-zinc-950">
      <JsonLd data={feedJsonLd} />
      <SiteHeader />

      <section className="border-b border-zinc-900/10">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-14 lg:py-16">
          <div className="max-w-2xl space-y-7">
            <span className="inline-flex rounded-full border border-brand-deep/20 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-deep">
              Design + AI news hub
            </span>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-zinc-950 sm:text-6xl lg:text-[3.7rem]">
                Useful signals for designers working with AI.
              </h1>
              <p className="max-w-xl text-base leading-8 text-zinc-600 sm:text-lg">
                Curated videos, launches, case studies, tools, essays, and
                studio notes worth opening before the feed moves on.
              </p>
            </div>
          </div>

          {featuredPost && (
            <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_90px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_32px_110px_rgba(15,23,42,0.14)]">
              <a
                href={featuredPost.link}
                target="_blank"
                rel="noreferrer"
                aria-label={featuredPost.title}
                className="relative block aspect-video w-full overflow-hidden bg-zinc-100"
              >
                <PostImage
                  imageUrl={featuredPost.thumbnail_url}
                  title={featuredPost.title}
                  className="h-full w-full transition duration-500 group-hover:scale-[1.02]"
                />
                <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-deep shadow-sm backdrop-blur">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand"></span>
                  Featured signal
                </span>
              </a>
              <div className="flex flex-1 flex-col gap-6 p-7 sm:p-9">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${getSourceTone(featuredPost.source)}`}
                  >
                    {featuredPost.source ?? "Source"}
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-700">
                    {featuredPost.category ?? "Design + AI"}
                  </span>
                </div>
                <a
                  href={featuredPost.link}
                  target="_blank"
                  rel="noreferrer"
                  className="line-clamp-3 block text-3xl font-black leading-[1.05] tracking-tight text-zinc-950 transition group-hover:text-brand-dark sm:text-[2.4rem]"
                >
                  {featuredPost.title}
                </a>
                <div className="mt-auto flex items-center justify-between gap-4 border-t border-zinc-100 pt-5">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-600">
                    {formatDate(featuredPost.created_at)}
                  </span>
                  <a
                    href={featuredPost.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-zinc-950 transition hover:gap-2.5 hover:text-brand-dark"
                  >
                    Open
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
            </article>
          )}
        </div>
      </section>

      {error && (
        <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            Supabase could not load posts right now. {error.message}
          </div>
        </div>
      )}

      {!error && posts.length === 0 && (
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-zinc-600">
            Add your first curated link in Supabase to start the DesAIgn feed.
          </div>
        </div>
      )}

      <JobsStrip />

      {!error && posts.length > 1 && (
        <FilterableGallery posts={posts.slice(1)} />
      )}

      <SiteFooter />
    </main>
  );
}
