import { supabase } from "@/lib/supabase";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";

// RSS 2.0 feed of the curated stream. Lets feed readers (Feedly, NetNewsWire),
// content aggregators, and some AI crawlers follow DesAIgn Radar passively.
// Cached for an hour — feed readers poll on their own schedule.
export const revalidate = 3600;

interface FeedRow {
  id: string;
  title: string;
  link: string | null;
  source: string | null;
  category: string | null;
  summary: string | null;
  created_at: string | null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const { data } = await supabase
    .from("posts")
    .select("id,title,link,source,category,summary,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  // Own content with no external link can't be a valid RSS item — skip it.
  const rows = ((data ?? []) as FeedRow[]).filter(
    (r): r is FeedRow & { link: string } => !!r.link,
  );

  const items = rows
    .map((row) => {
      const pubDate = row.created_at
        ? new Date(row.created_at).toUTCString()
        : new Date().toUTCString();
      // Each item links to the original creator's page — consistent with the
      // site's rule that we always point back to the curating source.
      const description = [row.source, row.summary]
        .filter(Boolean)
        .join(" — ");
      return `    <item>
      <title>${escapeXml(row.title)}</title>
      <link>${escapeXml(row.link)}</link>
      <guid isPermaLink="false">${escapeXml(row.id)}</guid>
      <pubDate>${pubDate}</pubDate>
      ${row.category ? `<category>${escapeXml(row.category)}</category>` : ""}
      <description><![CDATA[${description || row.title}]]></description>
    </item>`;
    })
    .join("\n");

  const lastBuildDate = rows[0]?.created_at
    ? new Date(rows[0].created_at).toUTCString()
    : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
