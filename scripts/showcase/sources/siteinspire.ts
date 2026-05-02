import * as cheerio from "cheerio";
import { ShowcasePick } from "../types";
import { fetchHtml, pickExternalUrl } from "../fetch-html";

const HOST = "https://www.siteinspire.com";
// Try in order: gallery, then homepage as fallback (both expose the same first card).
const SOURCES = [`${HOST}/websites`, `${HOST}/`];

function stripRef(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("ref");
    const qs = u.searchParams.toString();
    return u.origin + u.pathname + (qs ? "?" + qs : "");
  } catch {
    return url;
  }
}

export async function pickSiteinspire(): Promise<ShowcasePick | null> {
  let html: string | null = null;
  let lastErr: Error | null = null;
  for (const url of SOURCES) {
    try {
      html = await fetchHtml(url);
      break;
    } catch (err) {
      lastErr = err as Error;
    }
  }
  if (!html) throw lastErr ?? new Error("Siteinspire unreachable");

  const $ = cheerio.load(html);

  const card = $("a[href^='/website/']").first();
  if (!card.length) return null;

  const detailHref = card.attr("href") || "";
  const detailUrl = HOST + detailHref;
  const slugWithId = detailHref.replace(/^\/website\//, "").replace(/\/+$/, "");

  let title = (card.find("h2, h3, .title, .name").first().text() || "").trim();
  if (!title) title = card.attr("aria-label") || "";
  if (!title) {
    const idAndSlug = slugWithId.split("-");
    idAndSlug.shift(); // drop numeric id
    title = idAndSlug.join(" ").replace(/\b\w/g, (c) => c.toUpperCase()) || slugWithId;
  }

  const img = card.find("img").first();
  let thumbnail =
    img.attr("data-src") ||
    img.attr("data-lazy-src") ||
    img.attr("src") ||
    null;

  // Fetch the detail page to resolve the external URL.
  let externalUrl: string = detailUrl;
  try {
    const detailHtml = await fetchHtml(detailUrl);
    const $$ = cheerio.load(detailHtml);
    const externals: string[] = [];
    $$("a[href^='http']").each((_i, el) => {
      externals.push($$(el).attr("href") || "");
    });
    const picked = pickExternalUrl(externals);
    if (picked) externalUrl = stripRef(picked);
  } catch {
    // best-effort
  }

  return {
    source: "Siteinspire",
    award: "Featured",
    title,
    external_url: externalUrl,
    detail_url: detailUrl,
    thumbnail_url: thumbnail,
    published_at: new Date().toISOString(),
    source_id: `siteinspire:${slugWithId}`,
  };
}
