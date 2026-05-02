import * as cheerio from "cheerio";
import { ShowcasePick } from "../types";
import { fetchHtml } from "../fetch-html";

const HOME = "https://cssdesignawards.com/";
const HOST = "https://cssdesignawards.com";

export async function pickCssda(): Promise<ShowcasePick | null> {
  const html = await fetchHtml(HOME);
  const $ = cheerio.load(html);

  // SOTD card on the homepage. Detail URL pattern: /sites/<slug>/<id>/
  const candidates = [
    "a[href^='/sites/'][href*='/']",
    ".sotd a[href^='/sites/']",
    "a[href*='/sites/']",
  ];

  let card: cheerio.Cheerio<any> | null = null;
  let detailHref: string | undefined;
  for (const sel of candidates) {
    const a = $(sel).first();
    if (a.length) {
      const href = a.attr("href") || "";
      if (/^\/sites\/[^/]+\/\d+\/?$/.test(href)) {
        card = a;
        detailHref = href;
        break;
      }
    }
  }
  if (!card || !detailHref) return null;

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
