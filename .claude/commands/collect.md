---
description: Run the full DesAIgn Radar content collection pipeline. Use this skill whenever the user wants to collect content, check channels, run the YouTube collector, refresh the review queue, or generate the review report. Trigger on phrases like "collect", "check channels", "run collection", "refresh queue", "get new videos", "check studios", or any mention of running the pipeline.
---

# DesAIgn Radar — Collect & Review

Automate the full content pipeline: ask the user a short questionnaire → run the selected collectors → deduplicate → insert into `raw_items` (auto-rejecting any item without a thumbnail) → generate the HTML review report → open it in the browser.

## Step 1 — Ask the questionnaire (use `AskUserQuestion`)

Present three questions in a single `AskUserQuestion` call. The user can pick a preset *or* type a custom number via the auto-provided "Other" option — accept any positive integer.

**Question 1 — Sources** (`multiSelect: true`, header "Sources")
- "All" — Run all sources (YouTube + Design Studios + Showcases + Instagram)
- "YouTube" — Pull recent videos from monitored YouTube channels
- "Design Studios" — Scrape case studies from monitored design studios
- "Showcases" — Pick today's site of the day from Awwwards / TheFWA / CSSDA
- "Instagram" — Manually add Instagram posts (you'll paste image + post URLs)

**Notes on "All":**
- If the user selects "All", treat it as if they selected YouTube + Design Studios + Showcases + Instagram simultaneously.
- "All" and individual source options are mutually exclusive — if "All" is selected, ignore any other individual picks.

**Question 2 — Max items per channel/studio** (`multiSelect: false`, header "Max items")
- "5"
- "10"
- "20 (Recommended)"
- "50"

**Question 3 — Freshness window (days, YouTube only)** (`multiSelect: false`, header "Freshness")
- "1 day"
- "3 days"
- "7 days (Recommended)"
- "14 days"

**Notes:**
- `freshness` only affects YouTube. Design studio pages don't carry reliable publish dates, so freshness is ignored there.
- If the user hasn't selected YouTube, you may skip Question 3 — but it's fine to ask it anyway and ignore the answer.
- If the user picks "Other" for max items / freshness, parse the integer they typed. Ignore non-numeric input and fall back to the recommended default.

## Step 1.5 — Collect Instagram post URLs upfront (if Instagram selected)

Skip this step entirely if the user did NOT select "Instagram" (or "All") in Question 1.

**Do this immediately after the questionnaire — before running any collectors.** The user wants to give all their input upfront, not be interrupted mid-pipeline.

Ask **in plain text** (do NOT use `AskUserQuestion`):

> Paste image URL + post link for each Instagram post. One post per line:
>
> `image=https://...cdninstagram.com/.../img.jpg link=https://www.instagram.com/p/ABC123/`
>
> You can also include `title=...` after the link for a short headline. Reply "skip" if you changed your mind.

Parse each line the user provides and store the `image`, `link`, (optional) `title`, and (optional) `author` values. You'll run the add script in Step 4.5 after the automated collectors finish.

If the user replies "no", "skip", "none", or anything that doesn't contain `image=` and `link=`, treat Instagram count as 0 new and skip Step 4.5.

## Step 2 — Confirm channel / studio lists (only if needed)

By default, run with the configured sources. Skip this step entirely unless the user volunteers a custom list.

If the user wants to override:
- **YouTube:** accept URLs separated by commas, spaces, or newlines. Pass as `--channels="url1,url2"`.
- **Studios:** accept entries in the format `Name::https://url/work` separated by commas. Pass as `--studios="Pentagram::https://www.pentagram.com/work,Koto::https://koto.com/work"`.

## Step 3 — Run the YouTube collector

Skip if YouTube wasn't selected.

From the project root (`C:\My_files\My_Design_files\Pet Projects\DesAIgn\Site\desaign`):

```
npx tsx scripts/youtube/run.ts --insert --max-items=<N> --freshness=<DAYS>
```

Add `--channels="..."` only if the user supplied a custom list.

Capture and parse the output for:
- candidates per channel (with shorts skipped)
- duplicates already in raw_items
- auto-rejected items without a thumbnail
- rows inserted

## Step 4 — Run the Design Studios collector

Skip if Design Studios wasn't selected.

```
npx tsx scripts/design-studios/run.ts --insert
```

Do NOT pass `--max-items` here — the default is hardcoded to 1 per studio (always the newest case from the work listing). The questionnaire's max-items value only applies to YouTube.

Add `--studios="..."` only if the user supplied a custom list.

Capture and parse the output for:
- cases per studio
- duplicates
- auto-rejected items without a thumbnail
- rows inserted

Note: studios that require JavaScript rendering will automatically fall back to Playwright. This is expected.

## Step 4.25 — Run the Showcase collector

Skip if Showcases wasn't selected.

```
npx tsx scripts/showcase/run.ts --insert
```

The collector picks one Site of the Day from each of Awwwards, TheFWA, and CSSDA — typically 3 candidates per run, fewer if a source returned the same site as last run (dedup).

Capture from the output:
- per-source line: ✓ <title> → <external URL> (or ✗ <error>)
- "Inserted N rows into raw_items" tally

Do NOT pass `--max-items` or `--freshness` here — the showcase collector picks exactly one per source per run by design.

## Step 4.5 — Process Instagram posts collected in Step 1.5

Skip if the user skipped or provided no valid posts in Step 1.5.

For each parsed post from Step 1.5, run:

```
npx tsx scripts/instagram/add.ts --image=<image> --link=<link> [--title=<title>] [--author=<author>]
```

Capture inserted vs skipped (duplicate) outcomes. Include the tally in the Step 7 summary.

## Step 5 — Generate the review report

```
npx tsx scripts/report/generate-report.ts
```

Capture the "Items to review: N" line from the output.

## Step 6 — Open the report

```
start "" "reports/youtube-review.html"
```

The report has two tabs:
- **Review queue** — approve/reject individual items into `posts` + Telegram
- **X post** — copy-paste-ready X (Twitter) news roundup with a cover image, picking the newest 2 YouTube + 1 studio case by default; the user can switch to manual selection inside the tab if they want to choose specific items

## Step 7 — Print a concise summary

After all steps complete, print a summary like:

```
Collection complete
────────────────────────────────────
YouTube          3 new · 0 duplicates · 1 auto-rejected (no image)
Design Studios   5 new · 37 duplicates · 2 auto-rejected (no image)
Showcases        3 new · 0 duplicates (Awwwards / TheFWA / CSSDA)
Instagram        2 new · 0 duplicates (manual)
────────────────────────────────────
Total new in raw_items: 10
Review queue opened in browser → reports/youtube-review.html
Tip: switch to the "X post" tab to grab a copy-paste roundup.
```

Omit the Instagram line entirely if the user said no/skip in Step 4.5.

If nothing new was found:
```
Collection complete — no new items found. Queue is already up to date.
```

## Step 8 — Offer a jobs-cron health check

After printing the Step 7 summary, ask the user **in plain text** (one line):

> Also check the jobs cron? (check / skip)

Wait for their reply.

- On **"check"** (or any affirmative variant — "yes", "y", "go"): run an inline health check.
  1. Pull the last 10 runs of the `scrape-jobs` workflow:
     ```
     gh run list --workflow=scrape-jobs.yml --limit=10 --json databaseId,status,conclusion,createdAt,displayTitle
     ```
  2. Query Supabase to confirm data is fresh. The orchestrator writes
     `last_seen_at = now()` on every upsert, so the max `last_seen_at`
     across `source='scraper'` rows tells you when the cron last wrote
     successfully. Use the Supabase MCP / SQL client if available, or
     run a one-off `npx tsx -e "..."` script that reads the Supabase
     URL + service-role key from `.env.local` and prints:
     - max(last_seen_at) where source='scraper'
     - count of rows where active=true
     - per-platform breakdown
  3. Report concisely:
     - last 10 cron runs all green? yes/no
     - hours since most recent successful upsert (alarm if > 30h)
     - active jobs total + per-platform counts
     - any company that previously had jobs but now has 0 — best-effort,
       compare per-company kept counts to a freshly-printed baseline if
       it would take > 1 minute to compute, otherwise skip this bullet

- On **"skip"** (or "no", "n", anything else): end the turn normally.

Do NOT spawn a scheduled remote agent or `/schedule` anything. The user
declined that path explicitly — this inline check is the only sanctioned
form of jobs-cron monitoring.

## Auto-reject behavior (FYI for the user)

Items without a thumbnail image are inserted into `raw_items` with `status='rejected'` and a note (`Auto-rejected: no thumbnail`). They preserve the dedup invariant so the same URL won't be re-collected, but they never appear in the human review queue.

## Source extension guide

When LinkedIn, Medium, or other sources are added later, follow this pattern:
- Add the new source as another option in **Question 1** (the sources multiselect)
- Add a Step 3-equivalent that runs its collector with `--max-items=<N>` (and `--freshness=<DAYS>` if the source has a meaningful date field)
- Include its numbers in the Step 7 summary

Keep each source's logic isolated so adding one doesn't affect the others.
