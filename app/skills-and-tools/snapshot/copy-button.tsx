"use client";

import { useState } from "react";

// One-tap copy for the ready-made share text, so posting the monthly
// snapshot to LinkedIn / Reddit takes a single click.
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-full bg-zinc-950 px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white transition hover:bg-brand-deep"
    >
      {copied ? "Copied ✓" : "Copy share text"}
    </button>
  );
}
