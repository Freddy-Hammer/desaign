import type { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { SITE_URL, SITE_ROUTES } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = SITE_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Each published recap issue is its own indexable page.
  const { data } = await supabase
    .from("issues")
    .select("slug,published_at");

  const issueRoutes: MetadataRoute.Sitemap = (data ?? []).map((issue) => ({
    url: `${SITE_URL}/recap/${issue.slug}`,
    lastModified: new Date(issue.published_at),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...issueRoutes];
}
