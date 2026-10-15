"use client";

import { useState, useMemo, useEffect } from "react";
import type { Post } from "../types/post";
import { isImageFirstPost, SignalCard } from "./signal-card";
import { InlineSubscribe } from "./inline-subscribe";

type ContentType = "Videos" | "Images" | "Cases";

const CONTENT_TYPES: ContentType[] = ["Videos", "Cases", "Images"];
const PAGE_SIZE = 12;

function classifyType(post: Post): ContentType {
  const src = post.source?.toLowerCase() ?? "";
  if (src.includes("youtube")) return "Videos";
  if (isImageFirstPost(post)) return "Images";
  // Everything else is a design case study — no plain "articles" yet.
  return "Cases";
}

function dayAnchorId(day: string) {
  return `day-${day}`;
}

// Day keys are UTC calendar days ("2026-10-03", sliced from created_at), so
// every date shown for them is formatted in UTC — local time would shift the
// day back by one for anyone west of GMT.
function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDay(day: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" }).format(
    parseDay(day),
  );
}

function DayDivider({ day, index }: { day: string; index: number }) {
  const valid =
    day !== "unknown" && !Number.isNaN(parseDay(day).getTime());

  const weekday = valid ? formatDay(day, { weekday: "long" }) : "Recent";
  const month = valid ? formatDay(day, { month: "long" }).toUpperCase() : "";
  const dayNum = valid ? day.slice(8, 10) : "—";

  return (
    <div
      className={`flex items-end gap-5 border-b border-zinc-900/15 pb-4 sm:gap-7 ${
        index === 0 ? "mt-0" : "mt-16"
      } mb-7 scroll-mt-24`}
      id={dayAnchorId(day)}
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

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// "2026-10" shifted by `delta` months.
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

function signalsLabel(count: number) {
  return `${count} ${count === 1 ? "signal" : "signals"}`;
}

// A month calendar: days with posts are clickable, empty days are muted.
// One month at a time, so the rail stays compact however long the history gets.
function ArchiveCalendar({
  dayCounts,
  latestDay,
  selectedDay,
  inViewDay,
  onSelect,
}: {
  dayCounts: Map<string, number>;
  latestDay: string | null;
  selectedDay: string | null;
  inViewDay: string | null;
  onSelect: (day: string) => void;
}) {
  const firstMonth = useMemo(
    () => Array.from(dayCounts.keys()).sort()[0]?.slice(0, 7) ?? null,
    [dayCounts],
  );
  const lastMonth = latestDay?.slice(0, 7) ?? null;
  const [viewMonth, setViewMonth] = useState(lastMonth);

  if (!viewMonth || !firstMonth || !lastMonth) return null;

  const [year, month] = viewMonth.split("-").map(Number);
  const leadingBlanks = (parseDay(`${viewMonth}-01`).getUTCDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days = Array.from(
    { length: daysInMonth },
    (_, i) => `${viewMonth}-${String(i + 1).padStart(2, "0")}`,
  );
  const monthLabel = formatDay(`${viewMonth}-01`, {
    month: "long",
    year: "numeric",
  });

  const arrowClass =
    "flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-zinc-700 transition hover:bg-white hover:text-zinc-950 disabled:cursor-default disabled:text-zinc-300 disabled:hover:bg-transparent";

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-6">
        <a
          href="/subscribe"
          className="group mb-6 block rounded-lg bg-zinc-950 p-4 transition hover:bg-brand-deep"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand">
            Newsletter
          </p>
          <p className="mt-1.5 text-sm font-bold leading-snug text-white">
            New signals, in your inbox.
          </p>
          <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70 transition group-hover:text-white">
            Subscribe →
          </p>
        </a>
        <p className="mb-4 border-b border-zinc-900/15 pb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
          Archive
        </p>

        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setViewMonth(shiftMonth(viewMonth, -1))}
            disabled={viewMonth <= firstMonth}
            aria-label="Previous month"
            className={arrowClass}
          >
            ‹
          </button>
          <p className="text-sm font-black tracking-tight text-zinc-950" aria-live="polite">
            {monthLabel}
          </p>
          <button
            onClick={() => setViewMonth(shiftMonth(viewMonth, 1))}
            disabled={viewMonth >= lastMonth}
            aria-label="Next month"
            className={arrowClass}
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAY_LABELS.map((label) => (
            <span
              key={label}
              className="pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400"
            >
              {label}
            </span>
          ))}
          {Array.from({ length: leadingBlanks }, (_, i) => (
            <span key={`blank-${i}`} aria-hidden="true" />
          ))}
          {days.map((day) => {
            const count = dayCounts.get(day) ?? 0;
            const dayNum = Number(day.slice(8));
            if (count === 0) {
              return (
                <span
                  key={day}
                  className="flex aspect-square items-center justify-center text-xs tabular-nums text-zinc-300"
                >
                  {dayNum}
                </span>
              );
            }
            const selected = day === selectedDay;
            const inView = !selectedDay && day === inViewDay;
            return (
              <button
                key={day}
                onClick={() => onSelect(day)}
                aria-pressed={selected}
                aria-label={`${formatDay(day, { weekday: "long", month: "long", day: "numeric" })}, ${signalsLabel(count)}`}
                title={signalsLabel(count)}
                className={`flex aspect-square items-center justify-center rounded-full text-xs font-bold tabular-nums transition ${
                  selected
                    ? "bg-zinc-900 text-white"
                    : inView
                      ? "bg-white text-zinc-950 ring-1 ring-zinc-900/25"
                      : "text-zinc-800 hover:bg-white hover:text-zinc-950"
                }`}
              >
                {dayNum}
              </button>
            );
          })}
        </div>

        <div className="mt-4 border-t border-zinc-900/15 pt-3 text-xs">
          {selectedDay ? (
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-zinc-800">
                {formatDay(selectedDay, { weekday: "short", month: "short", day: "numeric" })}
                <span className="font-medium text-zinc-500">
                  {" · "}
                  {signalsLabel(dayCounts.get(selectedDay) ?? 0)}
                </span>
              </span>
              <button
                onClick={() => onSelect(selectedDay)}
                className="shrink-0 text-zinc-700 underline underline-offset-2 transition hover:text-zinc-950"
              >
                Show all
              </button>
            </div>
          ) : (
            <p className="leading-5 text-zinc-500">
              Pick a day to see what was posted.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

export function FilterableGallery({ posts }: { posts: Post[] }) {
  const [activeTypes, setActiveTypes] = useState<Set<ContentType>>(new Set());
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const [activeDay, setActiveDay] = useState<string | null>(null); // scroll-spy highlight
  const [dayFilter, setDayFilter] = useState<string | null>(null); // selected day filter

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTypes, activeTags, dayFilter]);

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

  // The most recent calendar day across all posts — its block always stays
  // pinned at the top, even when an older day is selected from the archive.
  const latestDay = useMemo(() => {
    let max: string | null = null;
    for (const p of posts) {
      const d = p.created_at?.slice(0, 10);
      if (d && (!max || d > max)) max = d;
    }
    return max;
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
        // When a day is selected, also keep the latest day visible on top.
        const postDay = post.created_at?.slice(0, 10) ?? "unknown";
        const dayOk = !dayFilter || postDay === dayFilter || postDay === latestDay;
        return typeOk && tagOk && dayOk;
      }),
    [posts, activeTypes, activeTags, dayFilter, latestDay],
  );

  const filtersActive =
    activeTypes.size > 0 || activeTags.size > 0 || dayFilter !== null;

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
    setDayFilter(null);
  }

  // A selected day is a focused view (latest day + that day) — show it whole,
  // no pagination. The default feed paginates.
  const visiblePosts = dayFilter
    ? filteredPosts
    : filteredPosts.slice(0, visibleCount);

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

  // Posts per day, from the full unfiltered post set — the calendar
  // represents the publication's history, not the current filtered view.
  const dayCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const post of posts) {
      const day = post.created_at?.slice(0, 10);
      if (!day) continue;
      map.set(day, (map.get(day) ?? 0) + 1);
    }
    return map;
  }, [posts]);

  // Selecting a day in the archive rail filters the feed to that day (plus
  // the latest day pinned on top). Clicking the already-selected day clears
  // the filter. The scroll lands on the selected day — see effect below.
  function selectDay(day: string) {
    setDayFilter((prev) => (prev === day ? null : day));
  }

  // After a day is selected, scroll to that day's block once it has rendered.
  useEffect(() => {
    if (!dayFilter || typeof document === "undefined") return;
    document
      .getElementById(dayAnchorId(dayFilter))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [dayFilter]);

  // Track which day section is currently in view to highlight the rail.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (dayGroups.length === 0) return;

    const observer = new IntersectionObserver(
      (records) => {
        // Pick the entry closest to the top of the viewport.
        const visible = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          if (id.startsWith("day-")) {
            setActiveDay(id.slice(4));
          }
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );

    dayGroups.forEach((g) => {
      const el = document.getElementById(dayAnchorId(g.day));
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [dayGroups]);

  const pillBase =
    "rounded-full border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] transition cursor-pointer select-none";
  const pillInactive =
    "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 hover:text-zinc-900";
  const pillActiveType = "border-brand bg-brand text-white";
  const pillActiveTag = "border-zinc-900 bg-zinc-900 text-white";
  const tagPillBase =
    "rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition cursor-pointer select-none";

  return (
    <section className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8">
      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <ArchiveCalendar
          dayCounts={dayCounts}
          latestDay={latestDay}
          selectedDay={dayFilter}
          inViewDay={activeDay}
          onSelect={selectDay}
        />

        <div>
          <div id="signals" className="mb-8 space-y-3">
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

          {filteredPosts.length > 0 && (
            <div id="latest">
              <div className="mb-10 flex items-end justify-between gap-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-dark">
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
                  {idx === 0 && dayGroups.length > 1 && <InlineSubscribe />}
                </div>
              ))}

              {!dayFilter && visibleCount < filteredPosts.length && (
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
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
