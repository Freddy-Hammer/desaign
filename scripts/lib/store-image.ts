import * as crypto from "crypto";
import sharp from "sharp";
import { getSupabase } from "./supabase-client";

// Source-agnostic image re-hosting. Some sources (notably Instagram) serve
// images from signed CDN URLs that expire within hours or days. Storing those
// URLs directly means thumbnails break later. storeImage downloads the image
// while the URL is still valid, downscales it, and uploads a permanent copy to
// Supabase Storage — returning a URL that never expires.

const BUCKET = "media";
const MAX_WIDTH = 800; // plenty for card + featured thumbnails on the site

/**
 * Download an image, downscale + recompress it, upload to Supabase Storage,
 * and return its permanent public URL.
 *
 * @param sourceUrl  The (possibly expiring) image URL to capture.
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

  // Downscale to MAX_WIDTH and recompress to WebP — smaller files, faster site,
  // and ~2-3x more images fit in the Storage quota.
  const output = await sharp(input)
    .rotate() // honour EXIF orientation before stripping metadata
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  // Content-addressed path: the same image always lands on the same object,
  // so re-adding a post never creates a duplicate file.
  const hash = crypto.createHash("sha1").update(output).digest("hex").slice(0, 16);
  const objectPath = `${prefix}/${hash}.webp`;

  const sb = getSupabase();
  const { error } = await sb.storage
    .from(BUCKET)
    .upload(objectPath, output, { contentType: "image/webp", upsert: true });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return sb.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
}
