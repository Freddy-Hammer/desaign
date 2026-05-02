import * as cheerio from "cheerio";
import { ShowcasePick } from "../types";
import { fetchHtml, pickExternalUrl } from "../fetch-html";

const HOME = "https://www.awwwards.com/";
const HOST = "https://www.awwwards.com";

export async function pickAwwwards(): Promise<ShowcasePick | null> {
  const html = await fetchHtml(HOME);
  const $ = cheerio.load(html);

  // The SOTD card is rendered as <a class="item-link" href="/sites/<slug>"
  // aria-label="<Name> - Site of the Day"></a> with most content client-rendered.
  // We only need the href and aria-label from the listing.
  const a = $("a[href^='/sites/']").first();
  if (!a.length) return null;
  const detailHref = a.attr("href")!;
  const ariaLabel = a.attr("aria-label") || "";
  const detailUrl = detailHref.startsWith("http") ? detailHref : HOST + detailHref;
  const slug = detailHref.replace(/\/+$/, "").split("/").pop() || "unknown";

  let title = ariaLabel.replace(/\s*[-–]\s*Site of the Day\s*$/i, "").trim();
  if (!title) title = slug.replace(/-/g, " ");

  // Detail page gives us og:image and the awarded site's external URL.
  let thumbnail: string | null = null;
  let externalUrl: string = detailUrl;
  try {
    const detailHtml = await fetchHtml(detailUrl);
    const $$ = cheerio.load(detailHtml);

    thumbnail =
      $$("meta[property='og:image']").attr("content") ||
      $$("meta[name='twitter:image']").attr("content") ||
      null;

    const externals: string[] = [];
    $$("a[href^='http']").each((_i, el) => {
      const href = $$(el).attr("href") || "";
      externals.push(href);
    });
    const picked = pickExternalUrl(externals);
    if (picked) externalUrl = picked;
  } catch {
    // best-effort
  }

  return {
    source: "Awwwards",
    award: "Site of the Day",
    title,
    external_url: externalUrl,
    detail_url: detailUrl,
    thumbnail_url: thumbnail,
    published_at: new Date().toISOString(),
    source_id: `awwwards:${slug}`,
  };
}
