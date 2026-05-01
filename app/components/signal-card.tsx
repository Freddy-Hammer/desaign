import type { Post } from "../types/post";

export function formatDate(value: string | null) {
  if (!value) {
    return "Fresh";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fresh";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function getSourceTone(_source: string | null) {
  // Single accent system: source pills stay neutral so thumbnails carry color variety.
  return "border-zinc-200 bg-white text-zinc-700";
}

export function isImageFirstPost(post: Post) {
  const source = post.source?.toLowerCase() ?? "";
  const category = post.category?.toLowerCase() ?? "";

  return (
    source.includes("instagram") ||
    category.includes("ai culture") ||
    category.includes("ai images")
  );
}

export function PostImage({
  imageUrl,
  title,
  className,
}: {
  imageUrl: string | null;
  title: string;
  className: string;
}) {
  if (!imageUrl) {
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
    // External thumbnails can come from many creator platforms, so keep MVP
    // image rendering provider-agnostic until the source list stabilizes.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={title}
      className={`${className} object-cover`}
    />
  );
}

export function SignalCard({ post }: { post: Post }) {
  if (isImageFirstPost(post)) {
    return (
      <article className="group overflow-hidden rounded-lg border border-zinc-200 bg-[#25252a] shadow-[0_18px_60px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-[0_26px_80px_rgba(15,23,42,0.10)]">
        <a
          href={post.link}
          target="_blank"
          rel="noreferrer"
          aria-label={post.title}
          className="relative block h-full"
        >
          <PostImage
            imageUrl={post.thumbnail_url}
            title={post.title}
            className="h-full min-h-[360px] w-full transition duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 bg-gradient-to-t from-zinc-950/80 via-zinc-950/30 to-transparent p-4 pt-16">
            <span className="rounded-full border border-white/20 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-950">
              {post.source ?? "Image"}
            </span>
            <span className="rounded-full border border-white/15 bg-[#25252a] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white">
              {post.category ?? "AI Culture"}
            </span>
          </div>
        </a>
      </article>
    );
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)] transition duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-[0_26px_80px_rgba(15,23,42,0.10)]">
      <a href={post.link} target="_blank" rel="noreferrer" className="block">
        <PostImage
          imageUrl={post.thumbnail_url}
          title={post.title}
          className="aspect-[16/10] w-full"
        />
      </a>

      <div className="flex flex-1 flex-col gap-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getSourceTone(
              post.source,
            )}`}
          >
            {post.source ?? "Source"}
          </span>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-700">
            {post.category ?? "Design + AI"}
          </span>
        </div>

        <div className="space-y-3">
          <a
            href={post.link}
            target="_blank"
            rel="noreferrer"
            className="block text-xl font-semibold leading-tight text-zinc-950 transition group-hover:text-brand-dark"
          >
            {post.title}
          </a>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-4 text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">
          <span>{formatDate(post.created_at)}</span>
          <a
            href={post.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-zinc-950 transition hover:gap-2.5 hover:text-brand-dark"
          >
            Open
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </article>
  );
}
