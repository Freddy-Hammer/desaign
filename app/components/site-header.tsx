import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-900/10 bg-[#f7f4ef]/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/"
          aria-label="DesAIgn — home"
          className="flex items-baseline text-2xl font-black tracking-tight sm:text-3xl"
        >
          <span>Des</span>
          <span className="text-brand">AI</span>
          <span>gn</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500 md:inline">
            Design + AI · curated
          </span>
          <Link
            href="/subscribe"
            className="rounded-full bg-zinc-950 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-brand-deep"
          >
            Subscribe
          </Link>
        </div>
      </div>
    </header>
  );
}
