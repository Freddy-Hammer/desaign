/**
 * Promotes raw_items tagged with metadata.auto_publish=true directly to
 * posts and sends each to Telegram. Called as the final step of the
 * collect-morning and collect-showcase GitHub Actions workflows.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { getSupabase } from "./lib/supabase-client";
import { probeImage } from "./lib/probe-image";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const SITE_URL = "https://desaign-radar.vercel.app";

function deriveCategory(contentType: string): string {
  if (contentType === "showcase") return "Site of the Day";
  if (contentType === "case_study") return "Case Study";
  if (contentType === "video") return "Video";
  return "Design + AI";
}

function buildCaption(post: { title: string; source: string | null; category: string; link: string }): string {
  const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return (
    `<b>${e(post.title)}</b>` +
    `\n\nSource: ${post.source ?? "Link"} · ${post.category}` +
    `\nLink: ${post.link}` +
    `\n\nDesAIgn Radar: ${SITE_URL}`
  );
}

async function sendToTelegram(post: {
  title: string;
  source: string | null;
  category: string;
  link: string;
  thumbnail_url: string | null;
}): Promise<void> {
  if (!BOT_TOKEN || !CHANNEL_ID) throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID");
  const caption = buildCaption(post);

  const call = async (method: string, body: unknown) => {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as { ok: boolean; description?: string };
  };

  // A thumbnail URL that exists but serves nothing usable (TheFWA publishes
  // 0-byte PNGs with HTTP 200) must degrade to a text post, not lose the item.
  const usablePhoto = Boolean(post.thumbnail_url) && (await probeImage(post.thumbnail_url!));

  if (usablePhoto) {
    const photo = await call("sendPhoto", {
      chat_id: CHANNEL_ID,
      photo: post.thumbnail_url,
      caption,
      parse_mode: "HTML",
    });
    if (photo.ok) return;
    console.warn(
      `    sendPhoto rejected (${photo.description ?? "unknown"}) — retrying as sendMessage`,
    );
  }

  const text = await call("sendMessage", {
    chat_id: CHANNEL_ID,
    text: caption,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });
  if (!text.ok) throw new Error(text.description ?? "Telegram API error");
}

async function main() {
  const sb = getSupabase();

  const { data: items, error } = await sb
    .from("raw_items")
    .select("*")
    .eq("status", "new")
    .filter("metadata->>auto_publish", "eq", "true")
    .not("thumbnail_url", "is", null);

  if (error) throw new Error(`Failed to fetch raw_items: ${error.message}`);
  if (!items?.length) {
    console.log("No auto-publish items found.");
    return;
  }

  console.log(`Auto-publishing ${items.length} item(s)...\n`);

  let published = 0;
  let failed = 0;

  for (const item of items) {
    const postData = {
      title: (item.raw_title ?? "").trim(),
      category: deriveCategory(item.content_type),
      thumbnail_url: item.thumbnail_url,
      link: item.source_url,
      source: item.source ?? "Unknown",
      telegram_sent: false,
    };

    try {
      // Guard against duplicates if the workflow runs twice or a previous run
      // partially failed before updating raw_items status to 'approved'.
      const { data: existing } = await sb
        .from("posts")
        .select("id")
        .eq("link", postData.link)
        .maybeSingle();
      if (existing) {
        await sb.from("raw_items").update({ status: "approved", processed_post_id: existing.id }).eq("id", item.id);
        console.log(`  ⟳ already published, skipped: ${postData.title}`);
        continue;
      }

      const { data: inserted, error: ie } = await sb
        .from("posts")
        .insert([postData])
        .select("id")
        .single();
      if (ie) throw new Error(`Insert to posts failed: ${ie.message}`);

      const { error: ue } = await sb
        .from("raw_items")
        .update({ status: "approved", processed_post_id: inserted.id })
        .eq("id", item.id);
      if (ue) throw new Error(`Update raw_items failed: ${ue.message}`);

      await sendToTelegram(postData);

      const { error: te } = await sb
        .from("posts")
        .update({ telegram_sent: true })
        .eq("id", inserted.id);
      if (te) {
        // The message HAS been delivered — never throw here, or the catch below
        // would count it as failed and invite a duplicate resend.
        console.warn(`    ⚠ sent, but telegram_sent flag not set: ${te.message}`);
      }

      console.log(`  ✓ ${postData.title}`);
      published++;
    } catch (err) {
      console.error(`  ✗ ${postData.title}: ${(err as Error).message}`);
      failed++;
    }

    // Telegram rate limit: 1 msg/sec
    if (published + failed < items.length) {
      await new Promise((r) => setTimeout(r, 1100));
    }
  }

  console.log(`\nDone. Published: ${published}, Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
