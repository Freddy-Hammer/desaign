import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// AI assistants increasingly answer "what's new in design + AI" directly,
// citing their sources. We explicitly welcome those crawlers so DesAIgn
// Radar can be one of those cited sources — alongside normal search bots.
const AI_CRAWLERS = [
  "GPTBot", // OpenAI — model training
  "OAI-SearchBot", // OpenAI — ChatGPT search index
  "ChatGPT-User", // OpenAI — live browsing on a user's behalf
  "ClaudeBot", // Anthropic — crawling
  "Claude-Web", // Anthropic — live browsing
  "anthropic-ai", // Anthropic — legacy agent
  "PerplexityBot", // Perplexity — search index
  "Perplexity-User", // Perplexity — live browsing
  "Google-Extended", // Google — Gemini / AI training
  "Applebot-Extended", // Apple — AI training
  "CCBot", // Common Crawl — feeds many open models
  "Amazonbot", // Amazon — Alexa / AI
  "cohere-ai", // Cohere
  "DuckAssistBot", // DuckDuckGo AI
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
