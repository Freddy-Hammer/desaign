# DesAIgn Operating Brief

Last updated: 2026-04-26

This folder is the living operating brief for DesAIgn Radar. Keep it updated when the product direction, content workflow, database schema, publishing rules, or automation plan changes.

## Product

DesAIgn Radar is a Design + AI discovery platform.

The public site curates useful external links and thumbnail previews from sources such as YouTube, Instagram, Medium, LinkedIn, design studios, launches, tutorials, and case studies.

This is a discovery/link platform, not a content-copy platform. The product should show short original summaries, source/category tags, thumbnails, and links back to original sources. Do not copy full articles, full case studies, full video transcripts, or full image sets.

Live site:

- https://desaign-radar.vercel.app

GitHub:

- https://github.com/Freddy-Hammer/desaign

## Current Stack

- Frontend: Next.js + Tailwind CSS
- Database: Supabase
- Hosting: Vercel
- Future automation: research and curation agents

## Working Principles For Future Automation

The project should be built for low-noise, low-token, repeatable work.

Agents should not scan the whole project unless the task truly requires it. Most changes should begin with targeted inspection:

- identify the likely file or system area first
- read only the relevant files
- use search before broad reading
- avoid rereading generated folders such as `.next` and `node_modules`
- avoid dumping large files into context when a smaller grep/search is enough
- summarize discovered context instead of carrying large raw outputs forward

For small UI requests, prefer the narrowest path:

```text
request -> locate component/style -> edit exact lines -> lint/build if needed -> commit/push if requested
```

Do not spend large context budgets on unrelated architecture, docs, dependencies, or database schema when the requested change is clearly local.

## Reusable Automation Rule

If a process is likely to happen more than once, create a reusable script instead of doing it manually every time.

Examples:

- collecting YouTube channel videos
- checking for duplicate `raw_items`
- promoting approved raw items into `posts`
- validating thumbnail URLs
- sending approved posts to Telegram
- generating reports from Supabase content
- cleaning or normalizing tags/categories

Scripts can be written in TypeScript, JavaScript, Python, SQL, or whichever tool fits the job best.

Reusable scripts should:

- live in a clear folder such as `scripts/`
- have a focused purpose
- accept inputs through arguments or environment variables
- avoid hardcoded secrets
- print concise summaries
- be safe to rerun when possible
- document required environment variables at the top of the file or in a nearby README

Prefer automation that can operate on a small selected dataset instead of loading everything.

## Plan Mode Questionnaire

When starting a new automation or larger feature, first ask only the questions needed to avoid wasted work.

Suggested questionnaire:

1. What is the immediate goal?
2. Is this a one-time task or a reusable workflow?
3. Which source is involved first? Example: YouTube, Instagram, Medium, LinkedIn, design studio sites, Telegram.
4. What is the smallest useful test case?
5. What inputs will the user provide? Example: channel URLs, freshness window, tags, categories.
6. What output should be produced? Example: `raw_items` rows, `posts` rows, Telegram messages, a local report.
7. Should the process publish automatically, or stop at review?
8. What should count as a duplicate?
9. What should be ignored?
10. What secrets or environment variables are required?
11. What should be logged so the user can audit what happened?
12. What is the rollback or safe retry plan if something goes wrong?

For the first automation phase, keep the answer simple:

```text
One YouTube research workflow
-> collect from user-provided channels
-> insert candidates into raw_items
-> no automatic public publishing
```

## Context Budget Guardrails

Agents should treat context as a limited resource.

Recommended behavior:

- start from this operating brief
- inspect `package.json` and the relevant app files only when code changes are needed
- inspect Supabase schema only when database behavior is involved
- inspect deployment/Git state only when publishing changes
- do not inspect unrelated folders just because they exist
- do not read media files, build output, or dependency folders unless explicitly necessary

When the task is small, the agent should keep its own working context small too.

Before doing broad exploration, the agent should explain why broad exploration is needed.

## Safety And Publishing Guardrails

Automation should default to review-first behavior.

Do not automatically publish to the public website or Telegram unless the workflow explicitly says publishing is allowed.

For early stages:

```text
collect -> raw_items -> human review
```

Only later:

```text
approved -> posts -> website -> Telegram
```

## Current Database Model

There are two important Supabase tables:

### `posts`

Public, approved content shown on the website.

Known columns:

- `id`
- `title`
- `link`
- `source`
- `category`
- `summary`
- `thumbnail_url`
- `created_at`

The website reads from `posts`.

RLS is enabled. Public visitors can read `posts` through the anon key.

### `raw_items`

Private collection and review inbox for automation.

This is where source-specific agents should save collected candidate links before anything is published.

Known columns:

- `id`
- `source`
- `source_url`
- `source_id`
- `content_type`
- `raw_title`
- `raw_description`
- `raw_author`
- `raw_published_at`
- `thumbnail_url`
- `captured_text`
- `tags`
- `status`
- `score`
- `notes`
- `duplicate_of`
- `processed_post_id`
- `metadata`
- `created_at`
- `updated_at`

`raw_items` has RLS enabled and should remain private. Do not add a public read policy for it.

## Target Long-Term Workflow

High-level future workflow:

```text
Source-specific agents collect links
-> raw_items
-> deduplicate
-> curator agent
-> score, summarize, tag, thumbnail
-> review queue
-> approved posts
-> posts table
-> DesAIgn website
-> Telegram channel
```

`raw_items` is the messy inbox. `posts` is the clean public feed.

## First Automation Experiment

Start small.

The first automation should use one source-specific agent only:

```text
YouTube research agent
```

The user will provide a list of YouTube channels to monitor.

The YouTube research agent should:

1. Check the provided channels for fresh Design + AI related videos.
2. Collect only candidate videos that look relevant for DesAIgn Radar.
3. Save candidates into `raw_items`.
4. Avoid duplicates using `source_url` and, when available, `source_id`.
5. Not publish directly to `posts`.
6. Not post directly to Telegram.

The goal of this first experiment is to prove the connection:

```text
YouTube channel list
-> source-specific collection
-> Supabase raw_items
-> manual review
```

After this works, add publishing from approved raw items into `posts`, then Telegram distribution.

## YouTube Raw Item Rules

For each candidate YouTube video, create one `raw_items` row.

Recommended mapping:

```text
source = "YouTube"
source_url = canonical YouTube video URL
source_id = YouTube video ID, if available
content_type = "video"
raw_title = video title
raw_description = short available description or curator note
raw_author = channel name
raw_published_at = video publish date, if available
thumbnail_url = YouTube thumbnail URL
tags = topic tags such as ["AI Tools", "UX", "Design"]
status = "new"
score = optional relevance score
notes = why this item may be useful for DesAIgn
metadata = source-specific JSON
```

Do not insert low-confidence junk. It is better to collect fewer useful items than many noisy ones.

## Suggested `metadata` Shape For YouTube

```json
{
  "platform": "youtube",
  "channel_url": "https://www.youtube.com/@example",
  "channel_name": "Example Channel",
  "video_id": "abc123",
  "duration": "12:34",
  "view_count": null,
  "collected_by": "youtube-research-agent",
  "collection_reason": "Relevant new AI design workflow video"
}
```

## Manual Review Rules

Before an item becomes public:

1. Check the original link.
2. Confirm the title and summary are accurate.
3. Confirm the thumbnail is appropriate.
4. Confirm the item is useful for designers interested in AI.
5. Approve it by creating a clean row in `posts`.

Future automation can help with this, but the MVP should keep human approval.

## Publishing Rules

Only approved items go into `posts`.

`posts` should stay clean and public-facing:

- clear title
- short original summary
- correct source
- useful category
- stable thumbnail URL
- link to original source

## Telegram Plan

Telegram should come later.

Preferred future flow:

```text
approved post in Supabase
-> Telegram message generated from approved post
-> Telegram channel
```

Telegram should not publish from raw agent findings directly.

## Legal And Content Safety Direction

DesAIgn should:

- use thumbnail previews only
- link back to the original source
- credit/show the source clearly
- write original short summaries
- avoid copying full articles, transcripts, or case-study content
- avoid bypassing paywalls or private content
- support takedown/removal requests later

Owned/generated funny AI images can be hosted by DesAIgn using Supabase Storage later.

## Immediate Next Step

Build or document the first YouTube research workflow.

Inputs needed from the user:

- YouTube channel URLs
- freshness window, for example last 24 hours, 3 days, or 7 days
- desired categories/tags
- whether to collect Shorts or ignore them

Expected output:

- candidate rows inserted into `raw_items`
- no public publishing yet
