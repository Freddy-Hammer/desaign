"use client";

import { useState } from "react";

export function PostImage({
  imageUrl,
  title,
  className,
}: {
  imageUrl: string | null;
  title: string;
  className: string;
}) {
  // Track the URL that failed rather than a boolean, so a re-render with a
  // different src (filtered gallery reusing this slot) is not stuck broken.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = imageUrl?.trim() || null; // two legacy rows store '' not null

  if (!src || failedSrc === src) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-[linear-gradient(135deg,#111827,#155e75_48%,#f59e0b)]`}
      >
        <span className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">
          DesAIgn
        </span>
      </div>
    );
  }

  return (
    // External thumbnails can come from many creator platforms, so keep image
    // rendering provider-agnostic until the source list stabilizes.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={title}
      onError={() => setFailedSrc(src)}
      className={`${className} object-cover`}
    />
  );
}
