# YouTube Channel Video Collector

Fetches recent videos from a list of YouTube channels and stages them in the Supabase `raw_items` table for human review. Nothing is published automatically.

## Required environment variables

Add these to `.env.local` at the project root before running:

```
YOUTUBE_API_KEY=<YouTube Data API v3 key>
SUPABASE_SERVICE_ROLE_KEY=<Supabase service role key>
NEXT_PUBLIC_SUPABASE_URL=<already set>
```

The service role key is required because `raw_items` has RLS enabled with no public write policy. The anon key cannot insert rows.

## Usage

```bash
# Dry run — prints candidates to console, writes nothing to Supabase
npx tsx scripts/youtube/run.ts

# Insert mode — writes new rows to raw_items
npx tsx scripts/youtube/run.ts --insert
```

Run from the project root.

## Configuration

Edit the constants at the top of `run.ts`:

- `CHANNELS` — list of YouTube channel URLs (supports `@handle` and `/channel/UCxxx` formats)
- `FRESHNESS_DAYS` — how many days back to look (default: 7)

## Shorts exclusion

Videos with a duration of 60 seconds or less are excluded. This uses the `contentDetails.duration` field from the YouTube Data API v3 (`videos.list`). Edge cases (mislabelled Shorts, premiere countdowns) may occasionally pass through — the human reviewer handles those.

## Output summary

```
Fetching from 2 channels, window: last 7 days
Mode: dry-run

Channel: @claude → 3 found, 0 skipped (shorts), 3 candidates
Channel: @DesignCourse → 14 found, 2 skipped (shorts), 12 candidates

Dedup: 0 already in raw_items

Dry run: 15 rows would be inserted (pass --insert to write)
```

## File structure

```
scripts/
  lib/
    raw-item-schema.ts   # Shared TypeScript type for a raw_items row
    supabase-client.ts   # Supabase client (service role, reusable by future agents)
    dedup.ts             # Batch duplicate check against raw_items
  youtube/
    fetch-channel-videos.ts  # YouTube API: channel URL → video list
    map-to-raw-item.ts       # Maps YouTube API shape → raw_items row
    run.ts                   # Entry point
    README.md                # This file
```

`lib/` is intentionally source-agnostic so future collectors (Instagram, Medium, LinkedIn) can reuse the Supabase client and dedup logic without touching YouTube-specific code.
