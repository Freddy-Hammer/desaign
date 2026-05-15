import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { storeImageBuffer } from "../lib/store-image";

// Uploads every image dropped into /incoming-images to the Supabase Storage
// `media` bucket and prints the permanent URL for each. Processed files are
// moved into incoming-images/_uploaded so re-runs don't repeat work.

const INCOMING = path.resolve(__dirname, "../../incoming-images");
const DONE = path.join(INCOMING, "_uploaded");
const IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;

async function main() {
  if (!fs.existsSync(INCOMING)) {
    console.error(`Folder not found: ${INCOMING}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(INCOMING)
    .filter(
      (f) => IMAGE_RE.test(f) && fs.statSync(path.join(INCOMING, f)).isFile(),
    );

  if (files.length === 0) {
    console.log("No images in incoming-images/. Drop some files and re-run.");
    return;
  }

  fs.mkdirSync(DONE, { recursive: true });
  console.log(`Uploading ${files.length} image(s) to Supabase Storage…\n`);

  let ok = 0;
  for (const file of files) {
    const full = path.join(INCOMING, file);
    try {
      const buffer = fs.readFileSync(full);
      const url = await storeImageBuffer(buffer, "memes", /\.gif$/i.test(file));
      console.log(`  ${file}\n    -> ${url}`);
      fs.renameSync(full, path.join(DONE, file));
      ok++;
    } catch (err) {
      console.error(`  ${file}\n    x ${(err as Error).message}`);
    }
  }

  console.log(
    `\nDone — ${ok}/${files.length} uploaded. ` +
      `Originals moved to incoming-images/_uploaded/.`,
  );
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
