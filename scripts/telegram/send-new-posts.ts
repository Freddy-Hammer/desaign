/**
 * Sends any posts with telegram_sent=false to the Telegram channel.
 * Safe to rerun — only processes unsent rows, marks each sent on success.
 *
 * Required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *                    TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID
 *
 * Usage:
 *   npx tsx scripts/telegram/send-new-posts.ts --dry-run
 *   npx tsx scripts/telegram/send-new-posts.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getSupabase } from "../lib/supabase-client";

const DRY_RUN = process.argv.includes("--dry-run");
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const SITE_URL = "https://desaign-radar.vercel.app";

type Post = {
  id: string;
  title: string;
  source: string | null;
  category: string | null;
  link: string;
  thumbnail_url: string | null;
};

function buildCaption(post: Post): string {
  const e = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let c = `<b>${e(post.title)}</b>`;
  c += `\n\nSource: ${post.source ?? "Link"} · ${post.category ?? "Design + AI"}`;
  c += `\nLink: ${post.link}`;
  c += `\n\nDesAIgn Radar: ${SITE_URL}`;
  return c;
}

async function sendPost(post: Post): Promise<void> {
  const caption = buildCaption(post);
  const hasThumbnail = Boolean(post.thumbnail_url);
  const method = hasThumbnail ? "sendPhoto" : "sendMessage";
  const body = hasThumbnail
    ? { chat_id: CHANNEL_ID, photo: post.thumbnail_url, caption, parse_mode: "HTML" }
    : { chat_id: CHANNEL_ID, text: caption, parse_mode: "HTML", disable_web_page_preview: false };

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
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

  const sb = getSupabase();
  const { data: posts, error } = await sb
    .from("posts")
    .select("id, title, source, category, link, thumbnail_url")
    .eq("telegram_sent", false)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch posts: ${error.message}`);
  if (!posts?.length) {
    console.log("No unsent posts.");
    return;
  }

  console.log(`${posts.length} unsent post(s)${DRY_RUN ? " [DRY RUN — nothing will be sent]" : ""}`);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i] as Post;
    console.log(`\n  → "${post.title}"`);
    if (DRY_RUN) continue;

    try {
      await sendPost(post);
      const { error: ue } = await sb
        .from("posts")
        .update({ telegram_sent: true })
        .eq("id", post.id);
      if (ue) throw new Error(`Supabase update failed: ${ue.message}`);
      console.log("    ✓ sent");
      sent++;
    } catch (err) {
      console.error(`    ✗ ${(err as Error).message}`);
      failed++;
    }

    if (i < posts.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\nDone. Sent: ${sent}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
