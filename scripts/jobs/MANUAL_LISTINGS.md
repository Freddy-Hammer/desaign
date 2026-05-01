# Manual listings

For companies the scraper cannot reach. Currently:

| Company | Why manual |
|---|---|
| Apple | proprietary ATS at jobs.apple.com |
| Pentagram | static HTML, currently no openings (scraper handles it when they post) |
| Buck, Studio Dumbar, Manual, &Walsh, Mucho, Base, Athletics | email-only applications |
| Ramotion | applications routed through Google Forms |
| Koto | Teamtailor (could become a generic Teamtailor scraper later) |
| Shopify | self-hosted JS-rendered ATS |
| Calm, Midjourney | Cloudflare 403 |

## Adding an entry

Edit `scripts/jobs/manual-listings.ts`:

```ts
export const MANUAL_LISTINGS: ManualEntry[] = [
  {
    company: "Apple",
    title: "Senior Designer, Apple Vision Pro",
    location: "Cupertino, CA",
    url: "https://jobs.apple.com/...",
    posted_date: "2026-04-20",
    department: "Design",
  },
];
```

The orchestrator will hash `(company, title, url)` into a stable id, derive
the category, and upsert the row with `source='manual'`. Manual rows are
NOT deactivated by the daily run — remove them from this file (and re-run)
when the role closes.

Re-run to apply:

```bash
npx tsx scripts/jobs/index.ts --insert
```

Or wait for the next daily cron — manual edits get picked up on the next
scheduled run.
