# incoming-images

Drop meme / image files here (`.jpg`, `.png`, `.webp`, `.gif`), then run:

```bash
npx tsx scripts/storage/upload-folder.ts
```

Each image is uploaded to the Supabase Storage `media` bucket and you get back
a permanent public URL. Static images are downscaled to 800px WebP; GIFs are
kept as-is to preserve animation.

Uploaded files are moved into `_uploaded/` so re-running won't repeat them.

The image files themselves are git-ignored — only this README is tracked.
