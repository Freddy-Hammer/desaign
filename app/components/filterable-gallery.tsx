"use client";

import { useState, useMemo } from "react";
import type { Post } from "../types/post";
import {
  isImageFirstPost,
  SignalCard,
  PostImage,
  getSourceTone,
  formatDate,
} from "./signal-card";

type ContentType = "Videos" | "Images" | "Articles";

const CONTENT_TYPES: ContentType[] = ["Videos", "Images", "Articles"];

function classifyType(post: Post): ContentType {
  const src = post.source?.toLowerCase() ?? "";
  if (src.includes("youtube")) return "Videos";
  if (isImageFirstPost(post)) return "Images";
  return "Articles";
}

export function FilterableGallery({ posts }: { posts: Post[] }) {
  const [activeTypes, setActiveTypes] = useState<Set<ContentType>>(new Set());
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const availableTags = useMemo(() => {
    const seen = new Set<string>();
    posts.forEach((p) => p.category && seen.add(p.category));
    return Array.from(seen).sort();
  }, [posts]);

  const filteredPosts = useMemo(
    () =>
      posts.filter((post) => {
        const typeOk =
          activeTypes.size === 0 || activeTypes.has(classifyType(post));
        const tagOk =
          activeTags.size === 0 ||
          (!!post.category && activeTags.has(post.category));
        return typeOk && tagOk;
      }),
    [posts, activeTypes, activeTags],
  );

  const filtersActive = activeTypes.size > 0 || activeTags.size > 0;
  const featuredPost = filteredPosts[0] ?? null;
  const gridPosts = filteredPosts.slice(1);

  function toggleType(type: ContentType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  function clearFilters() {
    setActiveTypes(new Set());
    setActiveTags(new Set());
  }

  const pillBase =
    "rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] transition cursor-pointer select-none";
  const pillInactive =
    "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400 hover:text-zinc-800";
  const pillActiveType = "border-cyan-300 bg-cyan-50 text-cyan-800";
  const pillActiveTag = "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <>
      <section id="signals" className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        {/* Filter bar */}
        <div className="mb-8 space-y-3">
          {/* Content type row */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={clearFilters}
              className={`${pillBase} ${activeTypes.size === 0 ? pillActiveType : pillInactive}`}
            >
              All
            </button>
            {CONTENT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`${pillBase} ${activeTypes.has(type) ? pillActiveType : pillInactive} flex items-center gap-1.5`}
              >
                <span className="inline-block h-2 w-2 rounded-full bg-zinc-950" />
                {type}
              </button>
            ))}
          </div>

          {/* Category tags row */}
          {availableTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`${pillBase} ${activeTags.has(tag) ? pillActiveTag : pillInactive}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Status row */}
          {filtersActive && (
            <div className="flex items-center gap-3 text-xs font-medium text-zinc-400">
              <span>
                {filteredPosts.length}{" "}
                {filteredPosts.length === 1 ? "result" : "results"}
              </span>
              <span>·</span>
              <button
                onClick={clearFilters}
                className="text-zinc-500 underline underline-offset-2 hover:text-zinc-800 transition"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Empty state */}
        {filtersActive && filteredPosts.length === 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center">
            <p className="text-sm font-medium text-zinc-500">
              No signals match these filters.
            </p>
            <button
              onClick={clearFilters}
              className="mt-4 rounded-full border border-zinc-300 px-5 py-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-600 transition hover:border-zinc-500 hover:text-zinc-950"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Featured post */}
        {featuredPost && (
          <article className="grid overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_24px_90px_rgba(15,23,42,0.08)] lg:grid-cols-[1.15fr_0.85fr]">
            <a href={featuredPost.link} target="_blank" rel="noreferrer">
              <PostImage
                imageUrl={featuredPost.thumbnail_url}
                title={featuredPost.title}
                className="h-full min-h-80 w-full"
              />
            </a>

            <div className="flex flex-col justify-between gap-10 p-7 sm:p-9">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-800">
                    {filtersActive ? "Top result" : "Featured signal"}
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

      {gridPosts.length > 0 && (
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
            {gridPosts.map((post) => (
              <SignalCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
