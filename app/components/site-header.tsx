"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
          <Link
            href="/jobs"
            className="hidden text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-700 transition hover:text-brand-deep md:inline"
          >
            Jobs
          </Link>
          <Link
            href="/skills-and-tools"
            className="hidden text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-700 transition hover:text-brand-deep md:inline"
          >
            Skills &amp; Tools
          </Link>
          <Link
            href="/subscribe"
            className="rounded-full bg-zinc-950 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-brand-deep"
          >
            Subscribe
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-900 transition hover:bg-zinc-900/5 md:hidden"
          >
            <span className="sr-only">Toggle menu</span>
            <span aria-hidden="true" className="relative block h-3.5 w-5">
              <span
                className={`absolute left-0 top-0 h-0.5 w-5 bg-current transition-transform duration-200 ${
                  open ? "translate-y-1.5 rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-1.5 h-0.5 w-5 bg-current transition-opacity duration-200 ${
                  open ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 top-3 h-0.5 w-5 bg-current transition-transform duration-200 ${
                  open ? "-translate-y-1.5 -rotate-45" : ""
                }`}
              />
            </span>
          </button>
        </div>
      </div>
      {open && (
        <div
          id="mobile-nav"
          className="border-t border-zinc-900/10 bg-[#f7f4ef] md:hidden"
        >
          <nav className="mx-auto flex max-w-7xl flex-col px-5 py-3 sm:px-8">
            <Link
              href="/jobs"
              className="py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-700 transition hover:text-brand-deep"
            >
              Jobs
            </Link>
            <Link
              href="/skills-and-tools"
              className="py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-700 transition hover:text-brand-deep"
            >
              Skills &amp; Tools
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
