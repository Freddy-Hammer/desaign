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
];
const FRESHNESS_DAYS = 7;
// -----------------------------

const INSERT_MODE = process.argv.includes("--insert");

// --channels "url1,url2" overrides the default list at runtime
const channelsArg = process.argv.find((a) => a.startsWith("--channels="));
const CHANNELS = channelsArg
  ? channelsArg.replace("--channels=", "").split(",").map((s) => s.trim()).filter(Boolean)
  : DEFAULT_CHANNELS;

async function main() {
  const publishedAfter = new Date();
  publishedAfter.setDate(publishedAfter.getDate() - FRESHNESS_DAYS);

  console.log(`Fetching from ${CHANNELS.length} channels, window: last ${FRESHNESS_DAYS} days`);
  console.log(`Mode: ${INSERT_MODE ? "INSERT" : "dry-run"}\n`);

  const allCandidates: { item: RawItem; channelUrl: string }[] = [];

  for (const channelUrl of CHANNELS) {
    try {
      const { videos, shortsSkipped } = await fetchChannelVideos(channelUrl, publishedAfter);
      const handle = channelUrl.split("@")[1] ?? channelUrl;
      console.log(
        `Channel: @${handle} → ${videos.length + shortsSkipped} found, ` +
          `${shortsSkipped} skipped (shorts), ${videos.length} candidates`
      );
      for (const video of videos) {
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

  console.log(`\nDedup: ${dupCount} already in raw_items`);

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
