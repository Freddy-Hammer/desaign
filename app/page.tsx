import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Post } from "./types/post";
import { FilterableGallery } from "./components/filterable-gallery";

export const revalidate = 0;

export default async function Home() {
  const { data, error } = await supabase
    .from("posts")
    .select("id,title,link,source,category,summary,thumbnail_url,created_at")
    .order("created_at", { ascending: false });

  const posts = (data ?? []) as Post[];

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

      {!error && posts.length > 0 && <FilterableGallery posts={posts} />}

      <footer className="border-t border-zinc-900/10 bg-[#25252a] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-black tracking-tight">DesAIgn Radar</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/60">
              Design and AI signals, useful links, and occasional strange image
              experiments from the edge of the feed.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="https://www.instagram.com/desaign_radar?igsh=MTQ2NTl4ZzNta28wNA%3D%3D"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white hover:text-zinc-950"
            >
              Instagram
            </a>
            <a
              href="https://t.me/DesAIgn_radar"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white hover:text-zinc-950"
            >
              Telegram
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
