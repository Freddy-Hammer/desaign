// Central SEO constants and structured-data builders.
// Used by metadata in app/layout.tsx, the sitemap, robots, and JSON-LD blocks.

export const SITE_URL = "https://desaign-radar.vercel.app";
export const SITE_NAME = "DesAIgn Radar";

export const SITE_TAGLINE =
  "Curated design + AI signals for designers";

export const SITE_DESCRIPTION =
  "DesAIgn Radar curates the most useful design and AI signals — videos, launches, case studies, tools, essays, studio notes, and designer jobs — so you see what matters without scrolling the feed.";

export const SITE_KEYWORDS = [
  "design and AI",
  "AI for designers",
  "AI design tools",
  "design news",
  "design inspiration",
  "designer jobs",
  "AI design jobs",
  "design case studies",
  "generative design",
  "UX and AI",
  "design radar",
];

// Static, crawlable routes. Posts and jobs link out to original creators,
// so there are no internal detail pages to enumerate here.
export const SITE_ROUTES = [
  { path: "/", changeFrequency: "daily" as const, priority: 1 },
  { path: "/jobs", changeFrequency: "daily" as const, priority: 0.9 },
  { path: "/skills-and-tools", changeFrequency: "weekly" as const, priority: 0.8 },
  { path: "/skills-and-tools/snapshot", changeFrequency: "weekly" as const, priority: 0.8 },
  { path: "/subscribe", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly" as const, priority: 0.3 },
];

// Organization + WebSite graph, emitted once site-wide from the root layout.
// Gives search engines and AI assistants a stable entity to attribute the
// brand, logo, and site purpose to.
export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/favicon.png`,
      description: SITE_DESCRIPTION,
      email: "desaignradar@gmail.com",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

/** Build an ItemList graph from a set of items that link out to originals. */
export function itemListJsonLd(
  name: string,
  url: string,
  items: { name: string; url: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        url: it.url,
      })),
    },
  };
}
