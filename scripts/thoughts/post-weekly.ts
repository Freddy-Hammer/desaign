/**
 * Posts one "Thought" image per run: picks the oldest image in Supabase
 * Storage that has not been posted yet, creates a linkless `posts` row
 * (source "DesAIgn", category "Thought"), and sends it to Telegram.
 *
 * Run weekly by .github/workflows/weekly-thought.yml (Tuesdays).
 *
 *   npx tsx scripts/thoughts/post-weekly.ts            # post one
 *   npx tsx scripts/thoughts/post-weekly.ts --dry-run  # show the pick, write nothing
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *               TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getSupabase } from "../lib/supabase-client";

const DRY_RUN = process.argv.includes("--dry-run");
const SITE_URL = "https://desaign-radar.vercel.app";
const BUCKET = "media";
const FOLDER = "memes"; // where upload-folder.ts stores dropped images
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

async function sendPhotoToTelegram(photoUrl: string): Promise<void> {
  if (!BOT_TOKEN || !CHANNEL_ID) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID");
  }
  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHANNEL_ID,
        photo: photoUrl,
        caption: `💭  ${SITE_URL}`,
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Telegram sendPhoto failed: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  const sb = getSupabase();

  // 1. All candidate images in storage, oldest first.
  const { data: files, error: listErr } = await sb.storage
    .from(BUCKET)
    .list(FOLDER, { limit: 500, sortBy: { column: "created_at", order: "asc" } });
  if (listErr) throw new Error(`Storage list failed: ${listErr.message}`);

  const images = (files ?? []).filter(
    (f) => f.name && /\.(png|jpe?g|webp|gif)$/i.test(f.name),
  );
  if (images.length === 0) {
    console.error(
      "::error::No images in storage — drop some into incoming-images/ and run scripts/storage/upload-folder.ts",
    );
    if (!DRY_RUN) process.exit(1);
    return;
  }

  const urls = images.map(
    (f) =>
      sb.storage.from(BUCKET).getPublicUrl(`${FOLDER}/${f.name}`).data.publicUrl,
  );

  // 2. Skip any image already used by a post.
  const { data: usedRows, error: usedErr } = await sb
    .from("posts")
    .select("thumbnail_url")
    .in("thumbnail_url", urls);
  if (usedErr) throw new Error(`posts lookup failed: ${usedErr.message}`);
  const used = new Set((usedRows ?? []).map((r) => r.thumbnail_url));

  const remaining = urls.filter((u) => !used.has(u));
  const pick = remaining[0];
  if (!pick) {
    console.error(
      "::error::Thought image pool is empty — every uploaded image has already " +
        "been posted. Add new ones to incoming-images/ and run scripts/storage/upload-folder.ts.",
    );
    if (!DRY_RUN) process.exit(1);
    return;
  }
  if (remaining.length <= 3) {
    console.warn(`::warning::Only ${remaining.length} unused Thought image(s) left — refill soon.`);
  }

  if (DRY_RUN) {
    console.log(`[dry-run] Would post this image as a Thought:\n  ${pick}`);
    return;
  }

  // 3. Create the linkless Thought post.
  const { data: inserted, error: insErr } = await sb
    .from("posts")
    .insert({
      title: "A thought",
      link: null,
      source: "DesAIgn",
      category: "Thought",
      thumbnail_url: pick,
    })
    .select("id")
    .single();
  if (insErr) throw new Error(`Post insert failed: ${insErr.message}`);

  // 4. Send to Telegram, then record it.
  await sendPhotoToTelegram(pick);
  await sb.from("posts").update({ telegram_sent: true }).eq("id", inserted.id);

  console.log(`Posted weekly Thought to site + Telegram:\n  ${pick}`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
