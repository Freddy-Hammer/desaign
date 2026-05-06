"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

declare global {
  interface Window {
    _uxa?: unknown[];
    dataLayer?: unknown[];
  }
}

export function AnalyticsRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const query = searchParams?.toString();
    const url = pathname + (query ? `?${query}` : "");

    window._uxa = window._uxa || [];
    window._uxa.push(["trackPageview", url]);

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "page_view",
      page_path: url,
    });
  }, [pathname, searchParams]);

  return null;
}
