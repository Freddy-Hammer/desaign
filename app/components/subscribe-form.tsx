"use client";

import { useEffect, useRef } from "react";

const BEEHIIV_FORM_ID = "b2cb7328-b7fd-478e-8f2e-5ef78a7b2d54";

export function SubscribeForm() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    if (host.querySelector("script[data-beehiiv-form]")) return;

    const script = document.createElement("script");
    script.src = "https://subscribe-forms.beehiiv.com/v3/loader.js";
    script.async = true;
    script.setAttribute("data-beehiiv-form", BEEHIIV_FORM_ID);
    host.appendChild(script);
  }, []);

  return <div ref={ref} className="flex w-full justify-center" />;
}
