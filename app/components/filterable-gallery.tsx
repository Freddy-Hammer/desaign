"use client";

import { useState, useMemo, useEffect } from "react";
import type { Post } from "../types/post";
import { isImageFirstPost, SignalCard } from "./signal-card";

type ContentType = "Videos" | "Images" | "Articles";

const CONTENT_TYPES: ContentType[] = ["Videos", "Images", "Articles"];
const PAGE_SIZE = 12;

function classifyType(post: Post): ContentType {
  const src = post.source?.toLowerCase() ?? "";
  if (src.includes("youtube")) return "Videos";
  if (isImageFirstPost(post)) return "Images";
  return "Articles";
}

function DayDivider({ day, index }: { day: string; index: number }) {
  const date = day === "unknown" ? null : new Date(day);
  const valid = date && !Number.isNaN(date.getTime());

  const weekday = valid
    ? new Intl.DateTimeFormat("en", { weekday: "long" }).format(date!)
    : "Recent";
  const month = valid
    ? new Intl.DateTimeFormat("en", { month: "long" })
        .format(date!)
        .toUpperCase()
    : "";
  const dayNum = valid ? String(date!.getDate()).padStart(2, "0") : "—";

  return (
    <div
      className={`flex items-end gap-5 border-b border-zinc-900/15 pb-4 sm:gap-7 ${
        index === 0 ? "mt-0" : "mt-16"
      } mb-7`}
    >
      <span
        aria-hidden="true"
        className="select-none text-[5.5rem] font-black leading-[0.85] tracking-tighter text-zinc-300 sm:text-[7rem]"
      >
        {dayNum}
      </span>
      <div className="pb-2">
        <p className="text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
          {weekday}
        </p>
        {month && (
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
            {month}
          </p>
        )}
      </div>
    </div>
  );
}

export function FilterableGallery({ posts }: { posts: Post[] }) {
  const [activeTypes, setActiveTypes] = useState<Set<ContentType>>(new Set());
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [topicsOpen, setTopicsOpen] = useState(false);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTypes, activeTags]);

  // Case-insensitive dedup so "Tutorial" / "tutorials" don't both show.
  const availableTags = useMemo(() => {
    const seen = new Map<string, string>();
    posts.forEach((p) => {
      if (!p.category) return;
      const key = p.category.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, p.category.trim());
    });
    return Array.from(seen.values()).sort();
  }, [posts]);

  const filteredPosts = useMemo(
    () =>
      posts.filter((post) => {
        const typeOk =
          activeTypes.size === 0 || activeTypes.has(classifyType(post));
        const tagOk =
          activeTags.size === 0 ||
          (!!post.category &&
            activeTags.has(post.category.trim().toLowerCase()));
        return typeOk && tagOk;
      }),
    [posts, activeTypes, activeTags],
  );

  const filtersActive = activeTypes.size > 0 || activeTags.size > 0;

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
    const key = tag.trim().toLowerCase();
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function clearFilters() {
    setActiveTypes(new Set());
    setActiveTags(new Set());
  }

  const visiblePosts = filteredPosts.slice(0, visibleCount);

  // Group visible posts by calendar day so each batch gets a typographic divider.
  const dayGroups = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of visiblePosts) {
      const day = post.created_at?.slice(0, 10) ?? "unknown";
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(post);
    }
    return Array.from(map.entries()).map(([day, list]) => ({ day, posts: list }));
  }, [visiblePosts]);

  const pillBase =
    "rounded-full border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] transition cursor-pointer select-none";
  const pillInactive =
    "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900";
  const pillActiveType = "border-cyan-700 bg-cyan-700 text-white";
  const pillActiveTag = "border-zinc-900 bg-zinc-900 text-white";
  const tagPillBase =
    "rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition cursor-pointer select-none";

  return (
    <>
      <section id="signals" className="mx-auto max-w-7xl px-5 pt-10 sm:px-8">
        {/* Filter bar — single row of primary type toggles + collapsible topics */}
        <div className="mb-8 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={clearFilters}
              className={`${pillBase} ${activeTypes.size === 0 && activeTags.size === 0 ? pillActiveType : pillInactive}`}
            >
              All
            </button>
            {CONTENT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`${pillBase} ${activeTypes.has(type) ? pillActiveType : pillInactive}`}
              >
                {type}
              </button>
            ))}
            {availableTags.length > 0 && (
              <>
                <span
                  aria-hidden="true"
                  className="mx-1 hidden h-5 w-px bg-zinc-300 sm:inline-block"
                />
                <button
                  onClick={() => setTopicsOpen((v) => !v)}
                  aria-expanded={topicsOpen}
                  className={`${pillBase} ${activeTags.size > 0 ? pillActiveTag : pillInactive} flex items-center gap-1.5`}
                >
                  Topics
                  {activeTags.size > 0 && (
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-zinc-900">
                      {activeTags.size}
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className={`text-[10px] transition ${topicsOpen ? "rotate-180" : ""}`}
                  >
                    ▾
                  </span>
                </button>
              </>
            )}
          </div>

          {topicsOpen && availableTags.length > 0 && (
            <div className="flex flex-wrap gap-2 rounded-xl border border-zinc-200 bg-white/60 p-3">
              {availableTags.map((tag) => {
                const key = tag.trim().toLowerCase();
                const active = activeTags.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleTag(tag)}
                    className={`${tagPillBase} ${active ? pillActiveTag : pillInactive}`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}

          {filtersActive && (
            <div className="flex items-center gap-3 text-xs font-medium text-zinc-500">
              <span>
                {filteredPosts.length}{" "}
                {filteredPosts.length === 1 ? "result" : "results"}
              </span>
              <span>·</span>
              <button
                onClick={clearFilters}
                className="text-zinc-700 underline underline-offset-2 transition hover:text-zinc-950"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {filtersActive && filteredPosts.length === 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white p-10 text-center">
            <p className="text-sm font-medium text-zinc-600">
              No signals match these filters.
            </p>
            <button
              onClick={clearFilters}
              className="mt-4 rounded-full border border-zinc-300 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950"
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      {filteredPosts.length > 0 && (
        <section id="latest" className="mx-auto max-w-7xl px-5 pb-16 sm:px-8">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-800">
                Latest finds
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">
                Curated for the next design sprint
              </h2>
            </div>
            <p className="hidden max-w-sm text-right text-sm leading-6 text-zinc-600 md:block">
              External links stay with their original creators. DesAIgn adds
              discovery, context, and rhythm.
            </p>
          </div>

          {dayGroups.map((group, idx) => (
            <div key={group.day}>
              <DayDivider day={group.day} index={idx} />
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {group.posts.map((post) => (
                  <SignalCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          ))}

          {visibleCount < filteredPosts.length && (
            <div className="mt-12 flex flex-col items-center gap-3">
              <button
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="rounded-full border border-zinc-300 bg-white px-7 py-3 text-xs font-bold uppercase tracking-[0.2em] text-zinc-800 transition hover:border-zinc-500 hover:text-zinc-950"
              >
                Load more
              </button>
              <p className="text-xs font-medium text-zinc-500">
                Showing {visibleCount} of {filteredPosts.length}
              </p>
            </div>
          )}
        </section>
      )}
    </>
  );
}
