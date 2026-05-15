import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getSupabase } from "../lib/supabase-client";

// One-time setup: creates the public `media` Storage bucket that storeImage()
// uploads re-hosted thumbnails into. Safe to re-run — it no-ops if the bucket
// already exists.
async function main() {
  const sb = getSupabase();

  const { error } = await sb.storage.createBucket("media", {
    public: true,
    fileSizeLimit: "5MB",
  });

  if (error) {
    if (/already exists/i.test(error.message)) {
      console.log("Bucket 'media' already exists — nothing to do.");
      return;
    }
    throw new Error(error.message);
  }

  console.log("Created public Storage bucket 'media'.");
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
