# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

DesAIgn Radar is a Design + AI discovery/curation platform. The public site shows thumbnails, summaries, and tags for links collected from YouTube, Instagram, Medium, LinkedIn, and similar sources — linking back to originals, never copying full content.

- Live site: https://desaign-radar.vercel.app
- Stack: Next.js 16 + Tailwind CSS 4 + Supabase + Vercel

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint check

# YouTube collector (run from project root)
npx tsx scripts/youtube/run.ts           # Dry run — prints candidates, writes nothing
npx tsx scripts/youtube/run.ts --insert  # Insert mode — writes to raw_items

# Review report
npx tsx scripts/report/generate-report.ts  # Generates reports/review.html from raw_items where status='new'

# Telegram catch-up (sends posts where telegram_sent=false)
npx tsx scripts/telegram/send-new-posts.ts --dry-run  # preview without sending
npx tsx scripts/telegram/send-new-posts.ts            # send all unsent posts

# Newsletter builder (generates a local picker for Beehiiv-ready HTML)
npx tsx scripts/newsletter/build.ts  # writes reports/newsletter.html

# Manual Instagram add (no IG API, so the user pastes image + post URL)
npx tsx scripts/instagram/add.ts --image=<url> --link=<url> [--title=<text>] [--author=<handle>]

# Showcase collector — picks one Site of the Day from each of:
#   Awwwards, TheFWA, CSSDA, Siteinspire (first carousel item)
# Writes raw_items rows with content_type='showcase'. Same review → posts → Telegram path.
npx tsx scripts/showcase/run.ts            # dry-run
npx tsx scripts/showcase/run.ts --insert   # writes to raw_items
```

## Architecture

### Two-table data model (Supabase)

**`posts`** — public, RLS-enabled, read by the website via anon key. Clean approved content: `id`, `title`, `link`, `source`, `category`, `summary`, `thumbnail_url`, `created_at`, `telegram_sent`, `newsletter_status` (null / 'queued' / 'sent' — set by `scripts/newsletter/build.ts` when assembling the Beehiiv weekly).

**`raw_items`** — private staging inbox for automation. Service role key required to write. Full schema in `operating-brief/README.md`. Key fields: `source_url`, `source_id`, `status` (new/approved/rejected), `score`, `tags`, `metadata`.

> **Dedup invariant**: rows must never be hard-deleted from `raw_items`. Rejecting an item sets `status='rejected'`; approving sets `status='approved'`. Both states are checked by `scripts/lib/dedup.ts` so the same URL is never re-inserted by a future collection run. Deleting a row breaks this guarantee.

### Content pipeline

```
YouTube (scripts/youtube/run.ts)
  → dedup check (scripts/lib/dedup.ts)
  → raw_items (status='new')
  → human review (reports/review.html)
  → manual promotion to posts + Telegram channel (single click in review UI)
  → public website
```

Automation must never write directly to `posts` or publish to Telegram without explicit human approval. The review UI fires both atomically on "Publish to posts →".

### Frontend (app/)

`app/page.tsx` is fully server-rendered (`revalidate = 0`). It reads from `posts` via the Supabase anon client in `lib/supabase.ts`. No API routes, no client-side state, no component library — all Tailwind utilities.

Key render logic: first post is featured full-width; rest render in a responsive 1→2→3 column grid. `SignalCard` component handles image-first vs text-first layout based on source. `PostImage` has a branded gradient fallback.

### Scripts (scripts/)

`scripts/lib/` is source-agnostic and reusable by future collectors:
- `supabase-client.ts` — singleton using `SUPABASE_SERVICE_ROLE_KEY`
- `dedup.ts` — batch duplicate check by `source_url` + `source_id`
- `raw-item-schema.ts` — TypeScript interface for `raw_items` rows

`scripts/youtube/` — YouTube Data API v3 collector. Configure `CHANNELS` and `FRESHNESS_DAYS` at the top of `run.ts`. Shorts (≤60s) are excluded automatically.

`scripts/report/` — generates a single-file HTML review UI from `raw_items where status='new'`.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL          # Frontend + scripts
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Frontend read-only
SUPABASE_SERVICE_ROLE_KEY         # Scripts write access to raw_items
YOUTUBE_API_KEY                   # scripts/youtube only — never NEXT_PUBLIC_
TELEGRAM_BOT_TOKEN                # scripts/telegram only — also embedded in review HTML (local file, never deployed)
TELEGRAM_CHANNEL_ID               # scripts/telegram only — numeric channel ID e.g. -1001234567890
```

## Operating Principles

- **Review-first**: all automation collects into `raw_items`; nothing auto-publishes to `posts` or Telegram.
- **Narrow path**: for UI tasks, locate the relevant component, edit exact lines, done. Don't scan unrelated folders.
- **Reusable scripts**: if it repeats, write a script in `scripts/`. Scripts must accept inputs via args/env vars, avoid hardcoded secrets, and be safe to rerun.
- **Context budget**: never read `.next/`, `node_modules/`, or media files. Grep before broad reads.
- **New collectors**: future sources (Instagram, Medium, LinkedIn) should add a folder under `scripts/` and reuse `scripts/lib/`.

Full product spec and publishing rules: `operating-brief/README.md`.
