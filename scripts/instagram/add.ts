import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getSupabase } from "../lib/supabase-client";
import { findExisting } from "../lib/dedup";
import type { RawItem } from "../lib/raw-item-schema";

interface Args {
  image: string;
  link: string;
  title?: string;
  author?: string;
}

function parseArgs(): Args {
  const result: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) result[m[1]] = m[2];
  }
  if (!result.image || !result.link) {
    console.error(
      "Usage:\n" +
        "  npx tsx scripts/instagram/add.ts --image=<url> --link=<url> [--title=<text>] [--author=<handle>]\n",
    );
    process.exit(1);
  }
  return result as unknown as Args;
}

// Pulls the shortcode out of /p/<id>/, /reel/<id>/, or /tv/<id>/. Falls back
// to the full URL so dedup still has something stable to compare on.
function extractShortcode(url: string): string {
  const m = url.match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : url;
}

async function main() {
  const args = parseArgs();
  const sb = getSupabase();
  const sourceId = extractShortcode(args.link);

  const existing = await findExisting([{ source_url: args.link, source_id: sourceId }]);
  if (existing.has(args.link)) {
    console.log(`Skipped (already in raw_items): ${args.link}`);
    return;
  }

  const row: RawItem = {
    source: "Instagram",
    source_url: args.link,
    source_id: sourceId,
    content_type: "image",
    raw_title: args.title || "Instagram post",
    raw_description: null,
    raw_author: args.author || null,
    raw_published_at: null,
    thumbnail_url: args.image,
    captured_text: null,
    tags: [],
    status: "new",
    score: null,
    notes: null,
    metadata: { manually_added: true },
  };

  const { error } = await sb.from("raw_items").insert([row]);
  if (error) {
    console.error(`Insert failed: ${error.message}`);
    process.exit(1);
  }

  console.log(`Inserted Instagram post → review queue: ${args.link}`);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
