import * as crypto from "crypto";
import sharp from "sharp";
import { getSupabase } from "./supabase-client";

// Source-agnostic image re-hosting. Some sources (notably Instagram) serve
// images from signed CDN URLs that expire within hours or days; storing those
// URLs directly means thumbnails break later. These helpers capture a
// permanent copy in Supabase Storage and return a URL that never expires.

const BUCKET = "media";
const MAX_WIDTH = 800; // plenty for card + featured thumbnails on the site

/**
 * Store an image already held in memory. Static images are downscaled and
 * recompressed to WebP; GIFs are kept as-is so animation is preserved.
 *
 * @param input   The raw image bytes.
 * @param prefix  Folder inside the bucket, e.g. "instagram" or "memes".
 * @param isGif   Pass true to upload unchanged (preserves animation).
 */
export async function storeImageBuffer(
  input: Buffer,
  prefix = "misc",
  isGif = false,
): Promise<string> {
  let output: Buffer;
  let ext: string;
  let contentType: string;

  if (isGif) {
    // Re-encoding would flatten an animated meme — keep the original bytes.
    output = input;
    ext = "gif";
    contentType = "image/gif";
  } else {
    output = await sharp(input)
      .rotate() // honour EXIF orientation before stripping metadata
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    ext = "webp";
    contentType = "image/webp";
  }

  // Content-addressed path: the same image always lands on the same object,
  // so re-uploading never creates a duplicate file.
  const hash = crypto.createHash("sha1").update(output).digest("hex").slice(0, 16);
  const objectPath = `${prefix}/${hash}.${ext}`;

  const sb = getSupabase();
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(objectPath, output, { contentType, upsert: true });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return sb.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

/**
 * Download an image from a (possibly expiring) URL and store a permanent copy.
 *
 * @param sourceUrl  The image URL to capture.
 * @param prefix     Folder inside the bucket, e.g. "instagram".
 */
export async function storeImage(
  sourceUrl: string,
  prefix = "misc",
): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Image fetch failed (HTTP ${res.status})`);
  }
  const input = Buffer.from(await res.arrayBuffer());
  return storeImageBuffer(input, prefix);
}
