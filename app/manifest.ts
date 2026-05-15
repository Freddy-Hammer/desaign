import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";

// Web app manifest — gives Android "Add to Home Screen" a proper name,
// icon, and colours (iOS uses apple-icon.tsx instead).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "DesAIgn",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ef",
    theme_color: "#475240",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
