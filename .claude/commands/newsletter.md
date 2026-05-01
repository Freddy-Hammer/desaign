# DesAIgn Radar — Newsletter Builder

Open the picker for the weekly Beehiiv newsletter. Shows posts already published to the site that haven't been sent in a previous issue, with items starred during review (`newsletter_status='queued'`) pre-checked.

Trigger this skill whenever the user says any of:
- "build the newsletter", "open the newsletter", "show me newsletter posts", "show me my picks"
- "newsletter picker", "newsletter builder", "ready for beehiiv"
- "what should I send this week", "give me my picked posts"
- Any mention of assembling, drafting, or copying the weekly digest into Beehiiv

## Step 1 — Run the builder

From the project root (`C:\My_files\My_Design_files\Pet Projects\DesAIgn\Site\desaign`):

```
npx tsx scripts/newsletter/build.ts
```

Capture the "Eligible posts (last 30d, unsent): N" line from the output. This includes both starred (`queued`) and unstarred (`null`) posts.

If the output instead says **"Schema migration required"**, surface the printed SQL to the user and ask them to run it in Supabase → SQL editor before re-trying. Do not loop or retry automatically.

## Step 2 — Open the report

```
start "" "reports/newsletter.html"
```

## Step 3 — Print a concise summary

```
Newsletter picker ready
────────────────────────────────────
Eligible posts (last 30d, unsent): N
Eligible jobs  (last 7d, unsent):  J

Picker opened → reports/newsletter.html
```

## What the picker does (FYI for the user)

- Filters: Days (7/14/30), Type (Videos/Articles/Images), "Show only ★ picks" toggle
- Pre-checks every post where `newsletter_status='queued'` (i.e. items the user starred during review)
- Below the post groups, shows a **💼 Open roles** group with designer-focused jobs from the last 7 days that haven't been included in a previous newsletter
- "Generate HTML →" produces paste-ready HTML for Beehiiv (Code/HTML view), grouped by Videos / Reads & studio notes / Images / 💼 Open roles, thumbnails optional via toolbar checkbox
- "Mark selected as sent" flips `newsletter_status='sent'` on checked items in BOTH the `posts` and `jobs` tables, so they drop out of next week's picker

## When to NOT trigger this skill

- The user wants to approve/reject *new* signals from collectors → that's `/collect` (writes to `raw_items`)
- The user wants to push to Telegram → that's the existing review flow's "Run all" button or `scripts/telegram/send-new-posts.ts`
- The user wants to change the newsletter format → that's editing `scripts/newsletter/build.ts`

## Schema dependency

This skill requires the `newsletter_status` column on BOTH the `posts` and `jobs` tables:

```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS newsletter_status text DEFAULT NULL;
ALTER TABLE jobs  ADD COLUMN IF NOT EXISTS newsletter_status text DEFAULT NULL;
```

The script will print the matching migration and exit non-zero if either column is missing.
