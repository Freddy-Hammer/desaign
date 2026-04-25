import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Post = {
  id: string;
  title: string;
  link: string;
  source: string | null;
  category: string | null;
  summary: string | null;
  image_url: string | null;
  created_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) {
    return "Fresh";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fresh";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function getSourceTone(source: string | null) {
  const normalized = source?.toLowerCase() ?? "";

  if (normalized.includes("youtube")) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (normalized.includes("x") || normalized.includes("twitter")) {
    return "border-neutral-300 bg-neutral-950 text-white";
  }

  if (normalized.includes("linkedin")) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }

  return "border-zinc-200 bg-white text-zinc-700";
}

function isImageFirstPost(post: Post) {
  const source = post.source?.toLowerCase() ?? "";
  const category = post.category?.toLowerCase() ?? "";

  return (
    source.includes("instagram") ||
    category.includes("ai culture") ||
    category.includes("ai images")
  );
}

function PostImage({
  imageUrl,
  title,
  className,
}: {
  imageUrl: string | null;
  title: string;
  className: string;
}) {
  if (!imageUrl) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-[linear-gradient(135deg,#111827,#155e75_48%,#f59e0b)]`}
      >
        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">
          DesAIgn
        </span>
      </div>
    );
  }

  return (
    // External thumbnails can come from many creator platforms, so keep MVP
    // image rendering provider-agnostic until the source list stabilizes.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={title}
      className={`${className} object-cover`}
    />
  );
}

function SignalCard({ post }: { post: Post }) {
  if (isImageFirstPost(post)) {
    return (
      <article className="group overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-[0_26px_80px_rgba(15,23,42,0.10)]">
        <a
          href={post.link}
          target="_blank"
          rel="noreferrer"
          aria-label={post.title}
          className="relative block"
        >
          <PostImage
            imageUrl={post.image_url}
            title={post.title}
            className="aspect-[4/5] w-full transition duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 bg-gradient-to-t from-zinc-950/80 via-zinc-950/30 to-transparent p-4 pt-16">
            <span className="rounded-full border border-white/20 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-950">
              {post.source ?? "Image"}
            </span>
            <span className="rounded-full border border-white/15 bg-[#25252a] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
              {post.category ?? "AI Culture"}
            </span>
          </div>
        </a>
      </article>
    );
  }

  return (
    <article className="group overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-[0_26px_80px_rgba(15,23,42,0.10)]">
      <a href={post.link} target="_blank" rel="noreferrer" className="block">
        <PostImage
          imageUrl={post.image_url}
          title={post.title}
          className="aspect-[16/10] w-full"
        />
      </a>

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getSourceTone(
              post.source,
            )}`}
          >
            {post.source ?? "Source"}
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
            {post.category ?? "Design + AI"}
          </span>
        </div>

        <div className="space-y-3">
          <a
            href={post.link}
            target="_blank"
            rel="noreferrer"
            className="block text-xl font-semibold leading-tight text-zinc-950 transition group-hover:text-cyan-800"
          >
            {post.title}
          </a>
          {post.summary && (
            <p className="line-clamp-3 text-sm leading-6 text-zinc-600">
              {post.summary}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-100 pt-4 text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
          <span>{formatDate(post.created_at)}</span>
          <span>Open link</span>
        </div>
      </div>
    </article>
  );
}

export default async function Home() {
  const { data, error } = await supabase
    .from("posts")
    .select("id,title,link,source,category,summary,image_url,created_at")
    .order("created_at", { ascending: false });

  const posts = (data ?? []) as Post[];
  const featuredPost = posts[0];
  const latestPosts = posts.slice(1);

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-zinc-950">
      <header className="border-b border-zinc-900/10 bg-[#f7f4ef]/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" className="text-lg font-black tracking-tight">
            DesAIgn
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-600 sm:flex">
            <a href="#signals" className="transition hover:text-zinc-950">
              Signals
            </a>
            <a href="#latest" className="transition hover:text-zinc-950">
              Latest
            </a>
          </nav>
        </div>
      </header>

      <section className="border-b border-zinc-900/10">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end lg:py-20">
          <div className="max-w-2xl space-y-7">
            <span className="inline-flex rounded-full border border-cyan-900/15 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-900">
              Design + AI news hub
            </span>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-zinc-950 sm:text-6xl lg:text-7xl">
                Useful signals for designers working with AI.
              </h1>
              <p className="max-w-xl text-base leading-8 text-zinc-600 sm:text-lg">
                Curated videos, launches, case studies, tools, essays, and
                studio notes worth opening before the feed moves on.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {["AI Tools", "UX", "Branding", "Studios", "Courses", "Launches"].map(
              (item) => (
                <div
                  key={item}
                  className="flex min-h-16 items-center justify-center rounded-full border border-zinc-800 bg-[#25252a] px-5 py-4 text-center font-bold text-white shadow-[0_14px_36px_rgba(24,24,27,0.18)]"
                >
                  {item}
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section id="signals" className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
            Supabase could not load posts right now. {error.message}
          </div>
        )}

        {!error && posts.length === 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white p-8 text-zinc-600">
            Add your first curated link in Supabase to start the DesAIgn feed.
          </div>
        )}

        {featuredPost && (
          <article className="grid overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_24px_90px_rgba(15,23,42,0.08)] lg:grid-cols-[1.15fr_0.85fr]">
            <a href={featuredPost.link} target="_blank" rel="noreferrer">
              <PostImage
                imageUrl={featuredPost.image_url}
                title={featuredPost.title}
                className="h-full min-h-80 w-full"
              />
            </a>

            <div className="flex flex-col justify-between gap-10 p-7 sm:p-9">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-800">
                    Featured signal
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${getSourceTone(
                      featuredPost.source,
                    )}`}
                  >
                    {featuredPost.source ?? "Source"}
                  </span>
                </div>

                <div className="space-y-4">
                  <a
                    href={featuredPost.link}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-3xl font-black leading-tight tracking-tight text-zinc-950 transition hover:text-cyan-800 sm:text-4xl"
                  >
                    {featuredPost.title}
                  </a>
                  {featuredPost.summary && (
                    <p className="text-base leading-8 text-zinc-600">
                      {featuredPost.summary}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-100 pt-5">
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-800">
                  {featuredPost.category ?? "Design + AI"}
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
                  {formatDate(featuredPost.created_at)}
                </span>
              </div>
            </div>
          </article>
        )}
      </section>

      {latestPosts.length > 0 && (
        <section id="latest" className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
          <div className="mb-7 flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-800">
                Latest finds
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">
                Curated for the next design sprint
              </h2>
            </div>
            <p className="hidden max-w-sm text-right text-sm leading-6 text-zinc-500 md:block">
              External links stay with their original creators. DesAIgn adds
              discovery, context, and rhythm.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {latestPosts.map((post) => (
              <SignalCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
