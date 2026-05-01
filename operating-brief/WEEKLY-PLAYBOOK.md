# DesAIgn Radar — Weekly Playbook

The end-to-end runbook for handling the publication week-by-week.
If you forget anything, just ask Claude "what should I do this week?" and
it will read this file back to you.

---

## What runs automatically (no action from you)

| Job | When | What happens |
|---|---|---|
| Jobs scraper | Every day at 06:00 UTC | Hits 26 ATS endpoints, refreshes the `jobs` table in Supabase, deactivates roles that disappeared from listings |
| Telegram jobs post | Every day right after the scraper | Posts the 1–2 freshest designer roles to the channel; silent on slow days |
| `/jobs` page | Always-on, refreshes every 6 hours | Reads from Supabase via Vercel ISR |
| Homepage strip | Always-on, fresh per request | Shows the 3 newest jobs above the gallery |

You do not have to be online for any of these. Your computer can be off
the whole time. All free tier.

---

## Your weekly rhythm (suggested)

A typical week looks like this. Days are flexible — the only fixed
deadline is sending the newsletter once a week on whichever day you've
chosen for Beehiiv.

### A few times a week — Refresh content

Whenever you want to top up the queue with new YouTube + studio finds:

```
/collect
```

Claude will ask you a 3-question intake (Sources, Max items, Freshness),
run the collectors, ask for any Instagram posts you want to add manually,
generate `reports/youtube-review.html`, and open it in your browser.

In the review HTML:
- **Approve** items you like → goes to `posts` + Telegram channel
- **Reject** items you don't → marked rejected, never re-collected
- **Star (★)** items you want to consider for the newsletter → they get
  pre-checked when you run `/newsletter` later

After `/collect` finishes, Claude will ask:

> Also check the jobs cron? (check / skip)

Type `check` to verify the GitHub Actions runs are green and Supabase
has fresh job data, or `skip` to end normally. Most weeks: skip.

### Once a week — Send the newsletter

Whenever you're ready to draft the weekly Beehiiv email:

```
/newsletter
```

Claude opens `reports/newsletter.html`. The picker shows everything
you've published in the last 30 days that hasn't been sent in a previous
newsletter, plus the **💼 Open roles** group with the last 7 days of
designer jobs that haven't been featured yet.

In the picker:
1. **Set your filters** at the top — Last 7 days is usually right
2. **Items you starred during review are pre-checked** — adjust as needed
3. **Pick 2–3 jobs** from the 💼 Open roles group for the Jobs corner
4. **Click "Generate HTML →"** — paste-ready styled cards appear
5. **Click "Copy HTML"**, then in Beehiiv:
   - New post → Code view → paste
   - Switch back to Visual view → write your intro paragraph and outro
   - Schedule or send
6. **Back in the picker, click "Mark selected as sent"** — flips both
   the post and job rows to `newsletter_status='sent'` so they don't
   appear in next week's picker

That's it for the week.

---

## Occasional / as-needed tasks

### Add a new job-board company

Edit `scripts/jobs/companies.ts`. Find the platform first by probing the
endpoints (the Claude `/collect` skill or me can help). Add a row in the
right section (greenhouse / lever / ashby / custom / skip), then run:

```
npx tsx scripts/jobs/index.ts --verbose
```

If `kept` looks reasonable, run with `--insert` or wait for tomorrow's
cron. Commit + push so the GitHub Actions runner picks it up.

### Manually add a job from a company we can't scrape

For Apple, design agencies that take applications by email, etc. Edit
`scripts/jobs/manual-listings.ts` and add an entry following the example
in that file. Re-run with `--insert` (or wait for the daily cron).
Manual rows get `source='manual'` and are NEVER deactivated by the daily
run — remove them from the file when the role closes.

### Telegram channel missed posts you approved

If you notice approved posts didn't make it to Telegram (rare, usually
network hiccup):

```
npx tsx scripts/telegram/send-new-posts.ts --dry-run    # preview first
npx tsx scripts/telegram/send-new-posts.ts              # actually send
```

This is for content posts. Job posts to Telegram don't need this — they
auto-retry the next day from the cron.

### A specific job is stuck or wrong on /jobs

In Supabase Studio, edit the row in the `jobs` table:
- `active = false` → removes it from the public site immediately (next
  ISR refresh, max 6h)
- `category = 'Design'` etc. → adjust the chip filter it lives under
- Don't delete the row — `active=false` preserves the dedup invariant
  so it doesn't get re-inserted by the next scrape

### A specific post needs to come down

Same idea, in the `posts` table — set `active=false` if the column
exists, otherwise delete the row.

---

## Troubleshooting (when something looks wrong)

### `/jobs` page hasn't updated in days

Visit https://github.com/Freddy-Hammer/desaign/actions. If recent
`scrape-jobs` runs are red, click into the failing one and read the log.
Usually the cause is a renamed ATS slug — fix in `scripts/jobs/companies.ts`,
push, re-run.

If the runs are green but the page is stale, the Vercel ISR cache is
just slow — wait up to 6 hours, or push any commit to force a redeploy.

### Telegram channel went quiet (no daily job posts)

That's normal on slow days — the script only posts truly new jobs from
the last 26h. If it's been silent for 3+ days, run a manual check:

```
npx tsx scripts/jobs/telegram-post.ts --dry-run
```

Output shows candidates and what would be sent. If "Candidates: 0",
nothing new this week. If candidates exist but the cron isn't sending,
check GitHub Actions logs.

### Newsletter picker says "Schema migration required"

You haven't run a SQL migration yet. The script prints the exact SQL to
copy into Supabase → SQL editor. Run it, then re-run `/newsletter`.

### "I don't remember the URL for X"

| Thing | URL |
|---|---|
| Live site | https://desaign-radar.vercel.app |
| Jobs page | https://desaign-radar.vercel.app/jobs |
| GitHub repo | https://github.com/Freddy-Hammer/desaign |
| GitHub Actions | https://github.com/Freddy-Hammer/desaign/actions |
| Vercel dashboard | https://vercel.com/dashboard (find "desaign") |
| Supabase dashboard | https://supabase.com/dashboard |
| Beehiiv | https://beehiiv.com |

---

## What costs money

Nothing currently. All services on free tiers, all hard-capped (Supabase,
Vercel, GitHub Actions on a public repo). The only billable surface is
this Claude conversation when you're chatting — the cron and the site
themselves spend zero tokens and zero dollars.

If your usage ever grows past free-tier limits, the platforms will email
you and the service will throttle — they cannot bill you without you
manually adding a card and clicking upgrade.

---

## Quick command reference

```bash
# Content collection (manual, a few times a week)
/collect                                      # via Claude

# Newsletter (manual, weekly)
/newsletter                                   # via Claude

# Jobs orchestrator (usually automated, run manually for testing)
npx tsx scripts/jobs/index.ts                 # dry run
npx tsx scripts/jobs/index.ts --verbose       # dry run with per-company log
npx tsx scripts/jobs/index.ts --insert        # write to Supabase

# Telegram jobs (usually automated, run manually for testing)
npx tsx scripts/jobs/telegram-post.ts --dry-run
npx tsx scripts/jobs/telegram-post.ts

# Telegram catch-up for content posts (manual recovery only)
npx tsx scripts/telegram/send-new-posts.ts --dry-run
npx tsx scripts/telegram/send-new-posts.ts

# Local dev
npm run dev                                   # localhost:3000
npm run build                                 # production build sanity check
npm run lint
```

---

Last updated when this file was written. Edit it whenever a process changes.
