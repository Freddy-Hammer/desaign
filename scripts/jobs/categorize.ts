import type { JobCategory } from "./schema";

export function categorize(title: string, department: string | null): JobCategory {
  const t = title.toLowerCase();
  const d = (department ?? "").toLowerCase();

  if (/\b(motion|animator|animation)\b/.test(t)) return "Motion";
  if (/\b(brand|identity|visual identity)\b/.test(t) && !/\bproduct\b/.test(t)) return "Brand";
  if (/\b(design engineer|design technologist|creative engineer|creative technologist)\b/.test(t)) {
    return "Design Eng";
  }
  if (/\b(ai|generative|prompt)\b/.test(t) && /\b(design|creative)\b/.test(t)) return "AI/Creative";
  if (/\b(design|designer|ux|ui|product design|interaction|art director|creative director|creative lead|illustrator|type)\b/.test(t)) {
    return "Design";
  }
  if (d === "design" || d === "brand" || d === "creative") return "Design";
  return "Other";
}
