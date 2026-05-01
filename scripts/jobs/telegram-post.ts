/**
 * Picks 1-2 of the freshest unsent designer-relevant jobs and posts each
 * to the Telegram channel. Idempotent — only sends rows where
 * telegram_sent_at IS NULL, marks them after a successful send.
 *
 * Source window: jobs first seen in the last 26 hours (small overlap so
 * nothing falls through the cracks between daily runs). If no new jobs,
 * the script exits cleanly without posting — the channel stays quiet on
 * slow days rather than catching up with stale roles.
 *
 * Required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *                    TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID
 *
 * Usage:
 *   npx tsx scripts/jobs/telegram-post.ts --dry-run
 *   npx tsx scripts/jobs/telegram-post.ts
 *   npx tsx scripts/jobs/telegram-post.ts --max=2  (default)
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getSupabase } from "../lib/supabase-client";

const DRY_RUN = process.argv.includes("--dry-run");
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const SITE_URL = "https://desaign-radar.vercel.app";

const FRESHNESS_HOURS = 26;
const DEFAULT_MAX = 2;

// Higher-priority categories appear first when there are more candidates than slots.
const CATEGORY_PRIORITY: Record<string, number> = {
  Design: 0,
  Brand: 1,
  "Design Eng": 2,
  Motion: 3,
  "AI/Creative": 4,
  Other: 5,
};

type Job = {
  id: string;
  company: string;
  title: string;
  location: string | null;
  url: string;
  category: string;
  first_seen_at: string;
};

function readMaxArg(): number {
  const arg = process.argv.find((a) => a.startsWith("--max="));
  if (!arg) return DEFAULT_MAX;
  const n = parseInt(arg.slice(6), 10);
  return Number.isFinite(n) && n > 0 && n <= 5 ? n : DEFAULT_MAX;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildMessage(job: Job): string {
  const e = escapeHtml;
  let msg = `💼 <b>${e(job.title)}</b>`;
  msg += `\n${e(job.company)} · ${e(job.category)}`;
  if (job.location) msg += `\n📍 ${e(job.location)}`;
  msg += `\n\n🔗 ${job.url}`;
  msg += `\n\nAll open roles: ${SITE_URL}/jobs`;
  return msg;
}

async function sendJob(job: Job): Promise<void> {
  const text = buildMessage(job);
  const body = {
    chat_id: CHANNEL_ID,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  };
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; description?: string };
  if (!json.ok) throw new Error(json.description ?? "Telegram API error");
}

async function main() {
  if (!BOT_TOKEN) throw new Error("Missing env var: TELEGRAM_BOT_TOKEN");
  if (!CHANNEL_ID) throw new Error("Missing env var: TELEGRAM_CHANNEL_ID");

  const max = readMaxArg();
  const cutoff = new Date(Date.now() - FRESHNESS_HOURS * 3600 * 1000).toISOString();

  const sb = getSupabase();
  const { data: rows, error } = await sb
    .from("jobs")
    .select("id, company, title, location, url, category, first_seen_at")
    .eq("active", true)
    .is("telegram_sent_at", null)
    .gte("first_seen_at", cutoff)
    .order("first_seen_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch jobs: ${error.message}`);
  const candidates = (rows ?? []) as Job[];

  if (candidates.length === 0) {
    console.log(`No new unsent jobs in the last ${FRESHNESS_HOURS}h. Skipping.`);
    return;
  }

  // Rank by category priority, then by freshness within each category.
  const ranked = [...candidates].sort((a, b) => {
    const pa = CATEGORY_PRIORITY[a.category] ?? 99;
    const pb = CATEGORY_PRIORITY[b.category] ?? 99;
    if (pa !== pb) return pa - pb;
    return b.first_seen_at.localeCompare(a.first_seen_at);
  });

  const picks = ranked.slice(0, max);
  console.log(`Candidates: ${candidates.length}, picking ${picks.length}${DRY_RUN ? " [DRY RUN]" : ""}`);

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < picks.length; i++) {
    const job = picks[i];
    console.log(`\n  → ${job.company}: "${job.title}" [${job.category}]`);
    if (DRY_RUN) {
      console.log(buildMessage(job).split("\n").map((l) => `      ${l}`).join("\n"));
      continue;
    }

    try {
      await sendJob(job);
      const { error: ue } = await sb
        .from("jobs")
        .update({ telegram_sent_at: new Date().toISOString() })
        .eq("id", job.id);
      if (ue) throw new Error(`Supabase update failed: ${ue.message}`);
      console.log("    ✓ sent");
      sent++;
    } catch (err) {
      console.error(`    ✗ ${(err as Error).message}`);
      failed++;
    }

    if (i < picks.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log(`\nDone. Sent: ${sent}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
