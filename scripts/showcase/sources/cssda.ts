import * as cheerio from "cheerio";
import { ShowcasePick } from "../types";
import { fetchHtml } from "../fetch-html";

// Homepages: try the canonical www host first (it's what cssdesignawards.com
// redirects to and what their CDN serves most reliably), then the apex as a
// fallback. CI runners occasionally see transient anti-bot challenges on one
// host but not the other.
const HOMES = ["https://www.cssdesignawards.com/", "https://cssdesignawards.com/"];
const HOST = "https://cssdesignawards.com";

export async function pickCssda(): Promise<ShowcasePick | null> {
  let html = "";
  let homeUsed = "";
  let lastFetchErr: Error | null = null;
  for (const home of HOMES) {
    try {
      html = await fetchHtml(home);
      homeUsed = home;
      break;
    } catch (err) {
      lastFetchErr = err as Error;
    }
  }
  if (!homeUsed) {
    throw new Error(`CSSDA homepage fetch failed on all hosts: ${lastFetchErr?.message ?? "unknown"}`);
  }
  const $ = cheerio.load(html);

  // SOTD card on the homepage. Detail URL pattern: /sites/<slug>/<id>/
  const candidates = [
    "a[href^='/sites/'][href*='/']",
    ".sotd a[href^='/sites/']",
    "a[href*='/sites/']",
  ];

  let card: cheerio.Cheerio<any> | null = null;
  let detailHref: string | undefined;
  const selectorCounts: Record<string, number> = {};
  for (const sel of candidates) {
    const matches = $(sel);
    selectorCounts[sel] = matches.length;
    if (!card) {
      for (let i = 0; i < matches.length; i++) {
        const a = matches.eq(i);
        const href = a.attr("href") || "";
        if (/^\/sites\/[^/]+\/\d+\/?$/.test(href)) {
          card = a;
          detailHref = href;
          break;
        }
      }
    }
  }
  if (!card || !detailHref) {
    // Surface failure loudly in CI logs (silent nulls are how 2026-05-21 and
    // 2026-05-22 went missing for two days before anyone noticed).
    const counts = Object.entries(selectorCounts).map(([s, n]) => `${s}=${n}`).join(", ");
    throw new Error(
      `CSSDA: no SOTD link found on ${homeUsed} (html=${html.length}B, selectors: ${counts}). ` +
        `Page structure may have changed or response was an anti-bot challenge.`
    );
  }

  const detailUrl = detailHref.startsWith("http") ? detailHref : HOST + detailHref;
  const slug = detailHref.split("/")[2] || "unknown";

  let title = (card.attr("title") || "").trim();
  if (!title) title = (card.find("h2, h3, .title").first().text() || "").trim();
  if (!title) title = slug.replace(/-/g, " ");

  let thumbnailRel =
    card.find("img").attr("data-src") ||
    card.find("img").attr("src") ||
    card.attr("data-bg") ||
    "";

  // Some cards use a CSS background-image inline style.
  if (!thumbnailRel) {
    const styled = card.find("[style*='background-image']").first().attr("style") || card.attr("style") || "";
    const m = styled.match(/url\(["']?([^"')]+)["']?\)/);
    if (m) thumbnailRel = m[1];
  }

  let thumbnail: string | null = null;
  if (thumbnailRel) {
    if (/^https?:\/\//.test(thumbnailRel)) thumbnail = thumbnailRel;
    else thumbnail = HOST + (thumbnailRel.startsWith("/") ? "" : "/") + thumbnailRel;
  }

  // Fetch detail page for the external URL.
  let externalUrl = detailUrl;
  try {
    const detailHtml = await fetchHtml(detailUrl);
    const $$ = cheerio.load(detailHtml);
    const candidates2 = [
      "a:contains('Visit website')",
      "a:contains('Visit Website')",
      "a.visit",
      "a.btn[href^='http']",
      "a[target=_blank][href^='http']",
    ];
    for (const sel of candidates2) {
      const a = $$(sel).first();
      const href = a.attr("href");
      if (href && /^https?:\/\//.test(href) && !/cssdesignawards\.com/.test(href)) {
        externalUrl = href;
        break;
      }
    }
  } catch {
    // best-effort
  }

  return {
    source: "CSSDA",
    award: "Site of the Day",
    title,
    external_url: externalUrl,
    detail_url: detailUrl,
    thumbnail_url: thumbnail,
    published_at: new Date().toISOString(),
    source_id: `cssda:${slug}`,
  };
}
