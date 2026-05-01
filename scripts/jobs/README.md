# Jobs pipeline

Daily aggregator that pulls designer-focused job listings from public ATS
endpoints (Greenhouse, Lever, Ashby) plus a small set of custom HTML
scrapers, applies a strict designer-only filter, and writes results to the
Supabase `jobs` table that powers `/jobs` on the site.

## Running locally

```bash
# Dry run — fetches everything, applies the filter, prints a per-company
# summary, but writes nothing.
npx tsx scripts/jobs/index.ts

# Same plus per-company verbose log
npx tsx scripts/jobs/index.ts --verbose

# Write to Supabase. Requires NEXT_PUBLIC_SUPABASE_URL and
# SUPABASE_SERVICE_ROLE_KEY in .env.local.
npx tsx scripts/jobs/index.ts --insert
```

The orchestrator scrapes 26 active companies in ~30s. Politeness delays:
1s between API calls, 3s between custom HTML fetches.

## Daily cron

`.github/workflows/scrape-jobs.yml` runs `npx tsx scripts/jobs/index.ts --insert`
every day at 06:00 UTC. It also exposes `workflow_dispatch` so you can fire
a manual run from the Actions tab.

Required GitHub Actions secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The runner is Ubuntu, Node 20, ~30s wallclock per run. Free for public repos.

## Adding a company

1. **Find the platform.** Check the company's careers page and the API root:
   - Greenhouse: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs` → 200 means yes
   - Lever: `https://api.lever.co/v0/postings/{slug}?mode=json` → 200 means yes
   - Ashby: `https://api.ashbyhq.com/posting-api/job-board/{slug}` → 200 means yes
   - None of the above: it's custom HTML or unscrapeable.

2. **Add a row to `companies.ts`** in the matching section:

   ```ts
   { name: "ExampleCo", platform: "greenhouse", slug: "exampleco" },
   ```

3. If platform is `custom`, also register a fetcher in
   `scrapers/custom.ts`'s `CUSTOM_SCRAPERS` map keyed by `name`.

4. Run `npx tsx scripts/jobs/index.ts --verbose` and confirm the new
   company shows up with sensible `raw=` / `kept=` counts.

5. Run with `--insert` (or wait for the daily cron) to push to Supabase.

## How the filter works

`scripts/jobs/filter.ts` runs in this order on each scraped title:

1. **Hardware excludes** — silicon/data-center/RTL/physical-design phrases.
   Cuts roles like `Physical Design Engineer` before any whitelist can fire.
2. **Engineer-variant whitelist** — `design engineer`, `creative engineer`,
   `design technologist`, `creative technologist` get included.
3. **Hard excludes** — `engineer(ing)` (catches every other engineer
   variant including ML, software, data, fullstack), data scientist/analyst,
   sales/account-executive/legal-counsel/etc.
4. **Strong includes** — `designer`, `product/ux/ui/brand/visual/motion/...
   design`, `art/creative director`, `head of design`, etc.
5. **Conditional includes** — `researcher` only when paired with
   `design`/`ux`/`creative`; `prompt engineer` only when paired with
   `design`/`creative`.
6. **Soft-exclude overrides** — `design ops`, `creative marketing`, etc.
7. **Soft excludes** — generic sales/marketing/PM/customer-success roles.
8. **Department tie-breaker** — when title is genuinely ambiguous and the
   ATS reports department = Design / Creative / Brand, include.
9. **Default exclude.**

Run `npx tsx scripts/jobs/test-stage3.ts` to exercise 76 unit cases that
cover the surprising boundaries (e.g., `Design Verification Engineer`
silicon role excluded; `AI Conversation Designer, Customer Support`
included because Designer wins over the team qualifier).

## Manual listings

For companies the scraper can't reach (Apple's proprietary ATS, design
agencies that take applications by email, JS-rendered SPAs we don't run
Playwright against), edit `scripts/jobs/manual-listings.ts`. Entries get
`source='manual'` in the DB so the daily run does NOT mark them inactive.
Remove an entry from the file and re-run to deactivate it.

## Schema

`schema.sql` is the one-time DDL. Already applied to the production Supabase
project. Re-runnable safely (uses `if not exists` / `drop policy if exists`).

## Architecture summary

```
scripts/jobs/
├── companies.ts          # 26 active + 26 skipped, with todos
├── schema.ts             # Job interface + jobId() hash
├── categorize.ts         # title -> category label for UI chips
├── filter.ts             # designer-focused include/exclude
├── manual-listings.ts    # human-curated entries
├── schema.sql            # Supabase DDL
├── index.ts              # orchestrator
├── lib/db.ts             # upsert + deactivate-unseen
├── scrapers/
│   ├── greenhouse.ts
│   ├── lever.ts
│   ├── ashby.ts
│   └── custom.ts         # registry of per-company HTML fetchers
└── test-stage{1..4}.ts   # progressive integration smoke tests
```
