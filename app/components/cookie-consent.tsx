"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";

// localStorage key for the user's choice. Bumping this version invalidates
// prior consent (e.g. if we add a new tracker to the list).
const STORAGE_KEY = "desaign_cookie_consent_v1";
type Choice = "accepted" | "declined";

declare global {
  interface Window {
    openCookieSettings?: () => void;
  }
}

export function CookieConsent() {
  // null = haven't read storage yet (avoids SSR/CSR mismatch flicker)
  const [choice, setChoice] = useState<Choice | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let saved: Choice | null = null;
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "accepted" || v === "declined") saved = v;
    } catch {
      // localStorage may throw in private mode — treat as no prior choice
    }
    setChoice(saved);
    setOpen(saved === null);

    // Expose a re-open hook for the footer "Cookie settings" link.
    window.openCookieSettings = () => setOpen(true);
    return () => {
      delete window.openCookieSettings;
    };
  }, []);

  const persist = (c: Choice) => {
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* ignore */
    }
    setChoice(c);
    setOpen(false);
  };

  return (
    <>
      {choice === "accepted" && <AnalyticsScripts />}

      {open && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Cookie consent"
          className="fixed inset-x-3 bottom-3 z-[100] sm:inset-x-auto sm:left-4 sm:right-4 sm:bottom-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md"
        >
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
            <p className="text-sm font-black tracking-tight text-zinc-950">
              Cookies, briefly.
            </p>
            <p className="mt-2 text-[13px] leading-6 text-zinc-600">
              We use Google Analytics and Contentsquare to understand how
              people use the site. They set cookies. Nothing about ads, nothing
              sold. Details in our{" "}
              <Link
                href="/privacy"
                className="font-semibold text-brand-deep underline decoration-brand-deep/30 underline-offset-2 hover:decoration-brand-deep"
              >
                Privacy Policy
              </Link>
              .
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => persist("accepted")}
                className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:bg-brand-deep"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => persist("declined")}
                className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-700 transition hover:border-zinc-500 hover:text-zinc-950"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AnalyticsScripts() {
  return (
    <>
      <Script
        src="https://t.contentsquare.net/uxa/2b523691042fe.js"
        strategy="afterInteractive"
      />
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-L39CHE00L0"
        strategy="afterInteractive"
      />
      <Script id="ga-config" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-L39CHE00L0');
        `}
      </Script>
    </>
  );
}
