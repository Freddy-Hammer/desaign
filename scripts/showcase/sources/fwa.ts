import * as cheerio from "cheerio";
import { ShowcasePick } from "../types";
import { fetchHtml, fetchXml, pickExternalUrl } from "../fetch-html";

const RSS = "https://thefwa.com/rss";

export async function pickFwa(): Promise<ShowcasePick | null> {
  const xml = await fetchXml(RSS);
  const $ = cheerio.load(xml, { xmlMode: true });

  const item = $("item").first();
  if (!item.length) return null;

  const detailUrl = item.find("link").first().text().trim();
  const title = item.find("title").first().text().trim();
  const pubDate = item.find("pubDate").first().text().trim();

  let thumbnail =
    item.find("enclosure").attr("url") ||
    item.find("media\\:content, content").attr("url") ||
    null;

  if (!thumbnail) {
    const descHtml = item.find("description").first().text();
    const m = descHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m) thumbnail = m[1];
  }

  // Resolve real external URL from the case page.
  let externalUrl: string = detailUrl;
  try {
    if (detailUrl) {
      const html = await fetchHtml(detailUrl);
      const $$ = cheerio.load(html);
      const externals: string[] = [];
      $$("a[href^='http']").each((_i, el) => {
        externals.push($$(el).attr("href") || "");
      });
      const picked = pickExternalUrl(externals);
      if (picked) externalUrl = picked;
    }
  } catch {
    // best-effort
  }

  const slug = detailUrl.replace(/\/+$/, "").split("/").pop() || "unknown";
  const publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();

  return {
    source: "TheFWA",
    award: "Site of the Day",
    title: title || slug,
    external_url: externalUrl,
    detail_url: detailUrl,
    thumbnail_url: thumbnail,
    published_at: publishedAt,
    source_id: `fwa:${slug}`,
  };
}
