import { load, type CheerioAPI } from "cheerio";

export interface StudioCase {
  projectUrl: string;
  projectSlug: string;
  studioName: string;
  studioBaseUrl: string;
  title: string;
  thumbnailUrl: string | null;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function studioSlugFrom(workUrl: string): string {
  return new URL(workUrl).hostname.replace(/^www\./, "").split(".")[0];
}

// Path segments that mark a project/case-study detail URL. The studio's own
// listing-path segment (derived from workUrl) is always included, so a studio
// on /projects, /works, /portfolio, /digital, etc. is matched the same as /work.
const KNOWN_SEGMENTS = [
  "work",
  "works",
  "project",
  "projects",
  "proyecto",
  "portfolio",
  "case",
  "cases",
  "case-study",
  "case-studies",
  "digital",
  "branding",
];

function buildLinkRegex(workUrl: string): RegExp {
  const first = new URL(workUrl).pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  const segments = first ? [first, ...KNOWN_SEGMENTS] : KNOWN_SEGMENTS;
  const uniq = [...new Set(segments)].map((s) => s.replace(/[^a-z0-9-]/gi, ""));
  return new RegExp(`/(?:${uniq.join("|")})/[^/?#]+`, "i");
}

// Non-project paths to exclude when falling back to flat-slug matching for
// studios whose project links are bare top-level paths (e.g. /niul, /osesp).
const NAV_DENYLIST = new Set([
  "work", "works", "project", "projects", "proyecto", "proyectos", "portfolio",
  "about", "studio", "studios", "team", "equipo", "contact", "contacto", "hola",
  "news", "blog", "journal", "careers", "jobs", "shop", "store", "archive",
  "services", "clients", "press", "home", "index", "search", "cart", "account",
  "privacy", "cookies", "terms", "legal", "privacy-policy", "cookies-policy",
  "corporate-policies", "start-a-project", "our-work", "our-skills", "case",
  "cases", "digital", "branding", "case-study", "case-studies",
]);

// Predicate for studios with bare top-level project URLs: a same-origin link
// with exactly one path segment that isn't a known navigation page.
function flatHrefMatcher(workUrl: string): (href: string) => boolean {
  const origin = new URL(workUrl).origin;
  return (href: string): boolean => {
    let u: URL;
    try {
      u = new URL(href, workUrl);
    } catch {
      return false;
    }
    if (u.origin !== origin) return false;
    const segs = u.pathname.split("/").filter(Boolean);
    return segs.length === 1 && !NAV_DENYLIST.has(segs[0].toLowerCase());
  };
}

// Extract the first URL from a srcset string (e.g. "img.jpg 800w, img2.jpg 1200w")
function firstFromSrcset(srcset: string | undefined): string | null {
  if (!srcset) return null;
  return srcset.split(",")[0]?.trim().split(/\s+/)[0] ?? null;
}

// URLs that look like lazy-load placeholders, sprites, or generated social
// cards — never a real case-study visual.
const JUNK_SRC_RE =
  /placeholder|spacer|blank\.|transparent|pixel\.|1x1|sprite|favicon|loading|lazy-?(?:load|img|placeholder)?\.|opengraph-image/i;

export function isJunkSrc(src: string | null | undefined): boolean {
  if (!src) return true;
  if (src.startsWith("data:")) return true;
  if (/\.svg(?:[?#]|$)/i.test(src)) return true;
  return JUNK_SRC_RE.test(src);
}

// Return the best available src from an img element, trying every known
// lazy-load attribute and preferring a real URL over a placeholder.
function bestImgSrc($el: ReturnType<CheerioAPI>): string | null {
  const candidates = [
    $el.attr("src"),
    $el.attr("data-src"),
    $el.attr("data-lazy-src"),
    $el.attr("data-original"),
    $el.attr("data-url"),
    firstFromSrcset($el.attr("srcset")),
    firstFromSrcset($el.attr("data-srcset")),
  ].filter((s): s is string => !!s);
  return candidates.find((s) => !isJunkSrc(s)) ?? candidates[0] ?? null;
}

// Extract background-image URL from an inline style string.
function bgFromStyle(style: string | undefined): string | null {
  if (!style) return null;
  const m = style.match(/background-image\s*:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
  return m?.[1] ?? null;
}

function extractCases(
  $: CheerioAPI,
  workUrl: string,
  studioName: string,
  hrefMatches: (href: string) => boolean,
): StudioCase[] {
  const origin = new URL(workUrl).origin;
  const studioSlug = studioSlugFrom(workUrl);
  const seen = new Set<string>();
  const cases: StudioCase[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    // must be a project-detail link — not the listing page or a nav item
    if (!hrefMatches(href)) return;

    const projectUrl = new URL(href, workUrl).href;
    if (seen.has(projectUrl)) return;
    seen.add(projectUrl);

    const slug = href.split(/[?#]/)[0].split("/").filter(Boolean).slice(-1)[0] ?? "";
    if (!slug || KNOWN_SEGMENTS.includes(slug.toLowerCase())) return;

    const img = $(el).find("img").first();
    const headingText = $(el)
      .find("h1, h2, h3, h4, [class*='title'], [class*='name'], [class*='heading']")
      .first()
      .text()
      .trim();
    const linkText = $(el).text().replace(/\s+/g, " ").trim();
    const slugText = slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    // An alt that's a bare image filename (e.g. "emblazoned.jpg") is not a
    // title — discard it so a real heading or the slug is used instead.
    const altRaw = img.attr("alt")?.trim() ?? "";
    const alt = /\.(?:jpe?g|png|webp|gif|svg|avif)$/i.test(altRaw) ? "" : altRaw;
    const title =
      alt ||
      headingText ||
      linkText.split(" ").slice(0, 8).join(" ") ||
      slugText;

    // --- Thumbnail: try every possible source, never give up ---
    let rawSrc: string | null = null;

    // 1. Image inside the link (all known lazy-load attrs + srcset)
    rawSrc = bestImgSrc(img);

    // 2. Background-image on the link itself or any direct child div/span
    if (!rawSrc) {
      rawSrc = bgFromStyle($(el).attr("style"));
    }
    if (!rawSrc) {
      $(el).find("div, span, figure").each((_, child) => {
        if (rawSrc) return;
        rawSrc = bgFromStyle($(child).attr("style"));
      });
    }

    // 3. Walk up to the nearest card-like ancestor and search wider
    if (!rawSrc) {
      const parent = $(el).closest(
        "[class*='card'], [class*='item'], [class*='project'], [class*='work'], [class*='case'], li, article, figure"
      );
      parent.find("img").each((_, sibling) => {
        if (rawSrc) return;
        rawSrc = bestImgSrc($(sibling));
      });
      if (!rawSrc) {
        parent.find("div, span, figure").each((_, child) => {
          if (rawSrc) return;
          rawSrc = bgFromStyle($(child).attr("style"));
        });
      }
    }

    let thumbnailUrl: string | null = null;
    if (rawSrc) {
      try {
        thumbnailUrl = new URL(rawSrc, origin).href;
      } catch {
        thumbnailUrl = null;
      }
    }

    cases.push({
      projectUrl,
      projectSlug: `${studioSlug}-${slug}`,
      studioName,
      studioBaseUrl: origin,
      title,
      thumbnailUrl,
    });
  });

  return cases;
}

function countProjectLinks($: CheerioAPI, workUrl: string): number {
  const linkRe = buildLinkRegex(workUrl);
  let count = 0;
  $("a[href]").each((_, el) => {
    if (linkRe.test($(el).attr("href") ?? "")) count++;
  });
  return count;
}

async function fetchHtml(workUrl: string): Promise<string | null> {
  try {
    const res = await fetch(workUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    });
    return res.ok ? res.text() : null;
  } catch {
    return null;
  }
}

// Fetch the first real image from an individual project page (static only).
// Used as a fallback when the listing page has no img tags (e.g. video-only tiles).
export async function fetchProjectThumbnail(projectUrl: string): Promise<string | null> {
  try {
    const res = await fetch(projectUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // OG image
    const og =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/)?.[1] ??
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/)?.[1];
    if (og?.trim() && !og.includes("og-image") && !isJunkSrc(og.trim())) return og.trim();

    // First real img — try src, then every common lazy-load attribute
    const candidates = [
      ...html.matchAll(/<img[^>]*\ssrc=["']([^"']+)["']/g),
      ...html.matchAll(/<img[^>]*\sdata-(?:src|lazy-src|original)=["']([^"']+)["']/g),
    ].map((m) => m[1]);

    for (const src of candidates) {
      if (isJunkSrc(src)) continue;
      try { return new URL(src, projectUrl).href; } catch { /* skip */ }
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchHtmlWithPlaywright(workUrl: string): Promise<string | null> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    // A real desktop UA — some studio sites serve an empty shell to the
    // default headless UA. Scrolling triggers lazy-loaded project grids.
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();
    // "domcontentloaded" + a fixed settle wait — many studio sites have
    // constant background network activity, so "networkidle" never fires.
    await page.goto(workUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(4_000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2_500);
    const html = await page.content();
    await browser.close();
    return html;
  } catch (err) {
    console.error("  Playwright fallback failed:", (err as Error).message);
    return null;
  }
}

// Picks the largest content image actually rendered on a project page.
// Passed to page.evaluate() as a STRING expression (not a function) — the
// tsx/esbuild build wraps named functions in a `__name` helper that is
// undefined in the browser context, so a function reference would throw.
// Skips nav/header/footer chrome, logos, and placeholder/sprite URLs.
const PICK_HERO_JS = `(() => {
  var junk = /placeholder|spacer|blank\\.|transparent|pixel\\.|1x1|sprite|favicon|loading|logo|icon|opengraph-image|\\.svg|data:/i;
  var chrome = "header,nav,footer,[class*='header'],[class*='nav'],[class*='footer'],[class*='menu'],[class*='logo'],[class*='cookie']";
  var inChrome = function (el) { return !!el.closest(chrome); };
  var best = null, bestArea = 0, r, area;
  var imgs = Array.prototype.slice.call(document.querySelectorAll("img"));
  for (var i = 0; i < imgs.length; i++) {
    var src = imgs[i].currentSrc || imgs[i].src || "";
    if (!src || junk.test(src) || inChrome(imgs[i])) continue;
    r = imgs[i].getBoundingClientRect();
    if (r.width < 320 || r.height < 200) continue;
    area = r.width * r.height;
    if (area > bestArea) { bestArea = area; best = src; }
  }
  if (best) return best;
  var vids = Array.prototype.slice.call(document.querySelectorAll("video[poster]"));
  for (var j = 0; j < vids.length; j++) {
    if (vids[j].poster && !junk.test(vids[j].poster) && !inChrome(vids[j])) return vids[j].poster;
  }
  var els = Array.prototype.slice.call(document.querySelectorAll("div,section,figure,a,span"));
  for (var k = 0; k < els.length; k++) {
    var bg = getComputedStyle(els[k]).backgroundImage;
    var m = bg && bg.match(/url\\(["']?([^"')]+)["']?\\)/);
    if (!m || junk.test(m[1]) || inChrome(els[k])) continue;
    r = els[k].getBoundingClientRect();
    if (r.width < 320 || r.height < 200) continue;
    area = r.width * r.height;
    if (area > bestArea) { bestArea = area; best = m[1]; }
  }
  return best;
})()`;

/**
 * Renders each project page in a real browser and returns a map of
 * projectUrl → case-study hero image. One browser instance, processed in
 * small concurrent batches. URLs with no resolvable hero are simply absent.
 */
export async function resolveHeroes(projectUrls: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const urls = [...new Set(projectUrls)];
  if (urls.length === 0) return result;

  let browser: Awaited<ReturnType<typeof import("playwright")["chromium"]["launch"]>> | null = null;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const CONCURRENCY = 4;

    for (let i = 0; i < urls.length; i += CONCURRENCY) {
      await Promise.all(
        urls.slice(i, i + CONCURRENCY).map(async (url) => {
          const page = await context.newPage();
          try {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
            await page.waitForTimeout(3_500);
            // Nudge the page so lazy-loaded hero images swap in their real src.
            await page.evaluate("window.scrollTo(0, 900)");
            await page.waitForTimeout(1_200);
            await page.evaluate("window.scrollTo(0, 0)");
            await page.waitForTimeout(600);
            const hero = (await page.evaluate(PICK_HERO_JS)) as string | null;
            if (hero) {
              try { result.set(url, new URL(hero, url).href); } catch { /* skip */ }
            }
          } catch (err) {
            console.error(`  hero render failed (${url}): ${(err as Error).message}`);
          } finally {
            await page.close();
          }
        }),
      );
    }
  } catch (err) {
    console.error("  Hero resolution failed:", (err as Error).message);
  } finally {
    if (browser) await browser.close();
  }
  return result;
}

export async function scrapeStudio(name: string, workUrl: string, limit?: number): Promise<StudioCase[]> {
  let html = await fetchHtml(workUrl);
  let $ = html ? load(html) : null;

  if (!$ || countProjectLinks($, workUrl) === 0) {
    console.log(`  ↳ Static fetch yielded no links — falling back to Playwright`);
    html = await fetchHtmlWithPlaywright(workUrl);
    $ = html ? load(html) : null;
  }

  if (!$) {
    console.error(`  Failed to load ${workUrl}`);
    return [];
  }

  const linkRe = buildLinkRegex(workUrl);
  let allCases = extractCases($, workUrl, name, (href) => linkRe.test(href));

  // Fallback for studios whose project URLs are bare top-level paths
  // (e.g. /niul, /ensayo-futuro) with no /work/ or /projects/ segment.
  if (allCases.length === 0) {
    console.log(`  ↳ No structured project links — trying flat-slug matching`);
    allCases = extractCases($, workUrl, name, flatHrefMatcher(workUrl));
  }

  const cases = limit && limit > 0 ? allCases.slice(0, limit) : allCases;

  // Resolve the thumbnail for every case from the project page itself.
  // Listing-page images are routinely lazy-load placeholders or one shared
  // cover, and og:image is often a branded social card — the rendered
  // case-page hero is the only consistently correct visual.
  if (cases.length > 0) {
    console.log(`  ↳ Resolving ${cases.length} thumbnail(s) from project pages…`);
    const heroes = await resolveHeroes(cases.map((c) => c.projectUrl));
    for (const c of cases) {
      const hero = heroes.get(c.projectUrl);
      if (hero) {
        c.thumbnailUrl = hero;
      } else if (!c.thumbnailUrl || isJunkSrc(c.thumbnailUrl)) {
        // Hero render failed — fall back to a static og:image / first img.
        c.thumbnailUrl = await fetchProjectThumbnail(c.projectUrl);
      }
    }
    const resolved = cases.filter((c) => c.thumbnailUrl).length;
    console.log(`  ↳ Resolved ${resolved}/${cases.length} thumbnails`);
  }

  return cases;
}
