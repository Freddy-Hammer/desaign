---
description: Run the full DesAIgn Radar content collection pipeline. Use this skill whenever the user wants to collect content, check channels, run the YouTube collector, refresh the review queue, or generate the review report. Trigger on phrases like "collect", "check channels", "run collection", "refresh queue", "get new videos", "check studios", or any mention of running the pipeline.
---

# DesAIgn Radar — Collect & Review

Automate the full content pipeline: ask the user a short questionnaire → run the selected collectors → deduplicate → insert into `raw_items` (auto-rejecting any item without a thumbnail) → generate the HTML review report → open it in the browser.

## Step 1 — Ask the questionnaire (use `AskUserQuestion`)

Present three questions in a single `AskUserQuestion` call. The user can pick a preset *or* type a custom number via the auto-provided "Other" option — accept any positive integer.

**Question 1 — Sources** (`multiSelect: true`, header "Sources")
- "YouTube" — Pull recent videos from monitored YouTube channels
- "Design Studios" — Scrape case studies from monitored design studios

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
npx tsx scripts/design-studios/run.ts --insert --max-items=<N>
```

Add `--studios="..."` only if the user supplied a custom list.

Capture and parse the output for:
- cases per studio
- duplicates
- auto-rejected items without a thumbnail
- rows inserted

Note: studios that require JavaScript rendering will automatically fall back to Playwright. This is expected.

## Step 4.5 — Optional: manually-added Instagram posts

Instagram has no usable public API, so this step is manual: the user pastes one or more posts they've found, and the script inserts them into `raw_items` so they show up in the review queue alongside the auto-collected items.

After Studios finishes (or after YouTube if Studios wasn't selected), ask the user **in plain text** (do NOT use `AskUserQuestion` — the format is too constrained for multi-line URL pairs):

> Any Instagram posts to add this round?
>
> If yes, paste image URL + post link for each one. One post per line, in this format:
>
> `image=https://...cdninstagram.com/.../img.jpg link=https://www.instagram.com/p/ABC123/`
>
> You can also include `title=...` after the link for a short headline. Reply "no" or "skip" to continue without adding any.

For each line the user replies with:
1. Parse `image=`, `link=`, and (optional) `title=` / `author=` segments. Be tolerant of whitespace and ordering.
2. Run:
   ```
   npx tsx scripts/instagram/add.ts --image=<image> --link=<link> [--title=<title>] [--author=<author>]
   ```
3. Capture inserted vs skipped (duplicate) outcomes.

If the user replies "no", "skip", "none", or anything that doesn't match an `image=...link=...` pair, move on without running the script.

Include the Instagram tally in the Step 7 summary (see template below).

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

## Auto-reject behavior (FYI for the user)

Items without a thumbnail image are inserted into `raw_items` with `status='rejected'` and a note (`Auto-rejected: no thumbnail`). They preserve the dedup invariant so the same URL won't be re-collected, but they never appear in the human review queue.

## Source extension guide

When LinkedIn, Medium, or other sources are added later, follow this pattern:
- Add the new source as another option in **Question 1** (the sources multiselect)
- Add a Step 3-equivalent that runs its collector with `--max-items=<N>` (and `--freshness=<DAYS>` if the source has a meaningful date field)
- Include its numbers in the Step 7 summary

Keep each source's logic isolated so adding one doesn't affect the others.
