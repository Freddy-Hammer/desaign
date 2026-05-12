import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-900/10 bg-[#25252a] text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-black tracking-tight">DesAIgn Radar</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-white/60">
            Design and AI signals, useful links, and occasional strange image
            experiments from the edge of the feed.
          </p>
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-white/50">
            <Link
              href="/privacy"
              className="transition hover:text-white"
            >
              Privacy
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/terms"
              className="transition hover:text-white"
            >
              Terms &amp; takedown
            </Link>
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/subscribe"
            className="rounded-full bg-white px-5 py-3 text-sm font-bold text-zinc-950 transition hover:bg-brand hover:text-white"
          >
            Subscribe
          </Link>
          <a
            href="https://www.instagram.com/desaign_radar?igsh=MTQ2NTl4ZzNta28wNA%3D%3D"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white hover:text-zinc-950"
          >
            Instagram
          </a>
          <a
            href="https://t.me/DesAIgn_radar"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white hover:text-zinc-950"
          >
            Telegram
          </a>
          <a
            href="https://x.com/DesAIgn_Radar"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white hover:text-zinc-950"
          >
            X
          </a>
          <a
            href="https://tally.so/r/Y5pvG5"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:border-white/40 hover:bg-white hover:text-zinc-950"
          >
            Mail
          </a>
        </div>
      </div>
    </footer>
  );
}
