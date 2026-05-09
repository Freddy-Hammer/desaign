/**
 * Position taxonomy: maps job titles to canonical roles for the
 * /skills-and-tools page filter. A single title can match multiple
 * positions on purpose ("Senior Product Design Manager" → Product
 * Designer + Design Manager), so the chart can answer either question.
 *
 * Patterns are matched against the title only, case-insensitive, with
 * word boundaries — keep them tight: "designer" alone is too broad to
 * be useful, "ux designer" is the right grain.
 */

export interface PositionEntry {
  name: string;
  patterns: string[];
}

export const POSITIONS: PositionEntry[] = [
  { name: "Product Designer", patterns: ["product designer", "product design", "product designers"] },
  { name: "UX Designer", patterns: ["\\bux\\b designer", "user experience designer", "ux/ui designer"] },
  { name: "UI Designer", patterns: ["\\bui\\b designer", "ui/ux designer"] },
  { name: "UX Researcher", patterns: ["\\bux\\b researcher", "user researcher", "user research", "rapid researcher", "product researcher", "design researcher", "quantitative ux", "qualitative ux"] },
  { name: "Brand Designer", patterns: ["brand designer", "brand identity", "brand design", "brand director", "brand & marketing", "brand and marketing"] },
  { name: "Motion Designer", patterns: ["motion designer", "motion graphics", "motion design"] },
  { name: "Visual Designer", patterns: ["visual designer", "visual communication", "visual design"] },
  { name: "Design Engineer", patterns: ["design engineer", "design technologist", "creative technologist", "creative technology"] },
  { name: "Content Designer / Writer", patterns: ["content designer", "ux writer", "content design", "narrative designer", "narrative design"] },
  { name: "Industrial Designer", patterns: ["industrial designer", "industrial design"] },
  { name: "Service Designer", patterns: ["service designer", "service design"] },
  { name: "Graphic Designer", patterns: ["graphic designer", "graphic design"] },
  { name: "Experience Designer", patterns: ["experience designer", "experience design"] },
  { name: "Creative Director", patterns: ["creative director", "creative lead", "art director"] },
  { name: "Design Manager / Lead", patterns: ["design manager", "design lead", "head of design", "design director", "head of product design", "director of product design", "executive design director", "policy design manager", "design lead\\b"] },
  { name: "AI Designer", patterns: ["\\bai\\b designer", "ai conversation designer", "conversation designer"] },
  { name: "Designer Advocate", patterns: ["designer advocate", "developer advocate"] },
  { name: "Solutions Designer", patterns: ["solutions designer", "solutions design"] },
  { name: "Interactive Designer", patterns: ["interactive designer", "interactive design"] },
  { name: "Creative Operations", patterns: ["creative operations", "creative ops"] },
  { name: "Performance / Marketing Designer", patterns: ["performance creative", "marketing designer", "paid media designer"] },
];

export function compilePositions(): [string, RegExp][] {
  return POSITIONS.map((p) => {
    const alts = p.patterns
      .map((pat) => {
        if (/[\\\[\]\(\)\|\?\*\+\^\$]/.test(pat)) return `(?:${pat})`;
        return `\\b${pat}\\b`;
      })
      .join("|");
    return [p.name, new RegExp(alts, "i")] as [string, RegExp];
  });
}

const _compiled = compilePositions();

export function positionsForTitle(title: string): string[] {
  const out: string[] = [];
  for (const [name, re] of _compiled) {
    if (re.test(title)) out.push(name);
  }
  return out;
}
