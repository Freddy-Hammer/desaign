import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { fetchChannelVideos } from "./fetch-channel-videos";
import { mapToRawItem } from "./map-to-raw-item";
import { findExisting } from "../lib/dedup";
import { getSupabase } from "../lib/supabase-client";
import { RawItem } from "../lib/raw-item-schema";

// --- Default configuration ---
const DEFAULT_CHANNELS = [
  "https://www.youtube.com/@claude",
  "https://www.youtube.com/@DesignCourse",
  "https://www.youtube.com/@anthropic-ai",
  "https://www.youtube.com/@UICollectiveDesign",
  "https://www.youtube.com/@NateBJones",
  "https://www.youtube.com/@OpenAI",
  "https://www.youtube.com/@thefutur",
  "https://www.youtube.com/@NNgroup",
  "https://www.youtube.com/@schoolofmotion",
  "https://www.youtube.com/@babichnick",
  "https://www.youtube.com/@Chase-H-AI",
  "https://www.youtube.com/@FluxAcademy",
  "https://www.youtube.com/@Figma",
  "https://www.youtube.com/@Rive_app",
  "https://www.youtube.com/@Webflow",
  "https://www.youtube.com/@Framer",
  "https://www.youtube.com/@splinetool",
];
const DEFAULT_FRESHNESS_DAYS = 7;
const DEFAULT_MAX_ITEMS_PER_CHANNEL = 50;
// -----------------------------

const INSERT_MODE = process.argv.includes("--insert");

function readNumberArg(flag: string, fallback: number): number {
  const arg = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (!arg) return fallback;
  const n = parseInt(arg.slice(flag.length + 1), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// --channels "url1,url2" overrides the default list at runtime
const channelsArg = process.argv.find((a) => a.startsWith("--channels="));
const CHANNELS = channelsArg
  ? channelsArg.replace("--channels=", "").split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_CHANNELS;

const FRESHNESS_DAYS = readNumberArg("--freshness", DEFAULT_FRESHNESS_DAYS);
const MAX_ITEMS_PER_CHANNEL = readNumberArg("--max-items", DEFAULT_MAX_ITEMS_PER_CHANNEL);

async function main() {
  const publishedAfter = new Date();
  publishedAfter.setDate(publishedAfter.getDate() - FRESHNESS_DAYS);

  console.log(`Fetching from ${CHANNELS.length} channels, window: last ${FRESHNESS_DAYS} days, max ${MAX_ITEMS_PER_CHANNEL}/channel`);
  console.log(`Mode: ${INSERT_MODE ? "INSERT" : "dry-run"}\n`);

  const allCandidates: { item: RawItem; channelUrl: string }[] = [];

  for (const channelUrl of CHANNELS) {
    try {
      const { videos, shortsSkipped } = await fetchChannelVideos(channelUrl, publishedAfter);
      const limited = videos.slice(0, MAX_ITEMS_PER_CHANNEL);
      const handle = channelUrl.split("@")[1] ?? channelUrl;
      const cap = limited.length < videos.length ? ` (capped at ${MAX_ITEMS_PER_CHANNEL})` : "";
      console.log(
        `Channel: @${handle} → ${videos.length + shortsSkipped} found, ` +
          `${shortsSkipped} skipped (shorts), ${limited.length} candidates${cap}`
      );
      for (const video of limited) {
        allCandidates.push({ item: mapToRawItem(video, channelUrl), channelUrl });
      }
    } catch (err) {
      console.error(`Error fetching ${channelUrl}:`, (err as Error).message);
    }
  }

  if (allCandidates.length === 0) {
    console.log("\nNo candidates found.");
    return;
  }

  // Dedup check
  const dedupInputs = allCandidates.map(({ item }) => ({
    source_url: item.source_url,
    source_id: item.source_id,
  }));

  const existing = INSERT_MODE
    ? await findExisting(dedupInputs)
    : new Set<string>(); // skip Supabase call in dry-run

  const newItems = allCandidates.filter(({ item }) => !existing.has(item.source_url));
  const dupCount = allCandidates.length - newItems.length;

  // Auto-reject rows with no thumbnail so they preserve the dedup invariant
  // but never appear in the human review queue.
  let autoRejected = 0;
  for (const c of newItems) {
    if (!c.item.thumbnail_url) {
      c.item.status = "rejected";
      c.item.notes = "Auto-rejected: no thumbnail";
      autoRejected++;
    }
  }

  console.log(`\nDedup: ${dupCount} already in raw_items`);
  if (autoRejected > 0) {
    console.log(`Auto-reject: ${autoRejected} item(s) without thumbnail`);
  }

  if (!INSERT_MODE) {
    console.log(`\nDry run: ${newItems.length} rows would be inserted (pass --insert to write)`);
    console.log("\nSample row:");
    console.log(JSON.stringify(newItems[0]?.item ?? {}, null, 2));
    return;
  }

  if (newItems.length === 0) {
    console.log("Nothing new to insert.");
    return;
  }

  const { error } = await getSupabase()
    .from("raw_items")
    .insert(newItems.map(({ item }) => item));

  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }

  console.log(`Inserted ${newItems.length} rows into raw_items`);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
