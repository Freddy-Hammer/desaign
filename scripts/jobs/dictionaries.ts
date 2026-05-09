/**
 * Dictionaries for skills + tools extracted from job descriptions.
 *
 * Each entry has a canonical `name` (what gets stored in jobs.skills/tools and
 * shown in the chart) and `patterns` — case-insensitive substrings or regex
 * sources that, when found in a description, count as a match. Patterns are
 * matched with word boundaries so "AI" doesn't trip on "GitHub" → "ai".
 *
 * Keep canonical names short and presentable (the page renders them as-is).
 * When adding entries, prefer broad synonyms: "Adobe Photoshop" → "Photoshop";
 * "shipping in fast-paced" → "fast-paced".
 *
 * To extend: add entries to TOOLS or SKILLS, run extraction:
 *   npx tsx scripts/jobs/extract-skills-tools.ts
 */

export interface DictionaryEntry {
  name: string;
  patterns: string[]; // matched as case-insensitive whole-word/phrase regex
}

export const TOOLS: DictionaryEntry[] = [
  // Design
  { name: "Figma", patterns: ["figma"] },
  { name: "FigJam", patterns: ["figjam"] },
  { name: "Sketch", patterns: ["sketch app", "sketch\\b"] },
  { name: "Adobe XD", patterns: ["adobe xd", "\\bxd\\b"] },
  { name: "Photoshop", patterns: ["photoshop", "\\bps\\b"] },
  { name: "Illustrator", patterns: ["illustrator", "adobe ai"] },
  { name: "InDesign", patterns: ["indesign"] },
  { name: "Lightroom", patterns: ["lightroom"] },
  { name: "Adobe Creative Suite", patterns: ["creative suite", "creative cloud", "adobe cc"] },
  { name: "Framer", patterns: ["framer"] },
  { name: "Webflow", patterns: ["webflow"] },
  { name: "Canva", patterns: ["canva"] },
  { name: "Miro", patterns: ["miro"] },
  { name: "Whimsical", patterns: ["whimsical"] },
  { name: "Notion", patterns: ["notion"] },
  { name: "Linear", patterns: ["linear app", "linear\\.app"] },
  { name: "Jira", patterns: ["jira"] },
  { name: "Confluence", patterns: ["confluence"] },
  { name: "Slack", patterns: ["slack"] },
  { name: "Asana", patterns: ["asana"] },
  { name: "Trello", patterns: ["trello"] },
  { name: "Airtable", patterns: ["airtable"] },

  // Motion / video / 3D
  { name: "After Effects", patterns: ["after effects", "\\bae\\b"] },
  { name: "Premiere Pro", patterns: ["premiere pro", "premiere"] },
  { name: "Final Cut", patterns: ["final cut"] },
  { name: "DaVinci Resolve", patterns: ["davinci resolve"] },
  { name: "Cinema 4D", patterns: ["cinema 4d", "c4d"] },
  { name: "Blender", patterns: ["blender"] },
  { name: "Spline", patterns: ["spline 3d", "spline\\.design", "\\bspline\\b"] },
  { name: "Houdini", patterns: ["houdini"] },
  { name: "Maya", patterns: ["autodesk maya", "\\bmaya\\b"] },
  { name: "Unity", patterns: ["unity 3d", "\\bunity\\b"] },
  { name: "Unreal Engine", patterns: ["unreal engine", "unreal"] },
  { name: "Lottie", patterns: ["lottie"] },
  { name: "Rive", patterns: ["rive\\b", "rive\\.app"] },
  { name: "Remotion", patterns: ["remotion"] },
  { name: "Runway", patterns: ["runway ml", "runwayml", "runway"] },

  // AI tools
  { name: "Claude", patterns: ["claude"] },
  { name: "ChatGPT", patterns: ["chatgpt", "chat gpt"] },
  { name: "Midjourney", patterns: ["midjourney", "mid journey"] },
  { name: "Stable Diffusion", patterns: ["stable diffusion"] },
  { name: "DALL·E", patterns: ["dall.?e"] },
  { name: "Cursor", patterns: ["cursor ide", "cursor editor", "cursor\\.com", "\\bcursor\\b"] },
  { name: "GitHub Copilot", patterns: ["github copilot", "\\bcopilot\\b"] },
  { name: "v0", patterns: ["v0\\.dev", "vercel v0"] },
  { name: "Lovable", patterns: ["lovable\\.dev", "\\blovable\\b"] },
  { name: "Bolt", patterns: ["bolt\\.new"] },
  { name: "Perplexity", patterns: ["perplexity"] },
  { name: "Gemini", patterns: ["google gemini", "\\bgemini\\b"] },

  // Code / dev
  { name: "Git", patterns: ["\\bgit\\b"] },
  { name: "GitHub", patterns: ["github"] },
  { name: "GitLab", patterns: ["gitlab"] },
  { name: "VS Code", patterns: ["vs code", "visual studio code", "vscode"] },
  { name: "Storybook", patterns: ["storybook"] },
  { name: "Zeplin", patterns: ["zeplin"] },
  { name: "Abstract", patterns: ["abstract\\.com"] },

  // Languages / frameworks (often listed in design-eng / hybrid roles)
  { name: "HTML", patterns: ["\\bhtml5?\\b"] },
  { name: "CSS", patterns: ["\\bcss3?\\b"] },
  { name: "JavaScript", patterns: ["javascript", "\\bjs\\b"] },
  { name: "TypeScript", patterns: ["typescript", "\\bts\\b"] },
  { name: "React", patterns: ["react\\b", "react\\.js", "reactjs"] },
  { name: "Next.js", patterns: ["next\\.js", "nextjs"] },
  { name: "Vue", patterns: ["vue\\.js", "vuejs", "\\bvue\\b"] },
  { name: "Svelte", patterns: ["svelte"] },
  { name: "Tailwind", patterns: ["tailwind"] },
  { name: "GSAP", patterns: ["gsap", "greensock"] },
  { name: "Three.js", patterns: ["three\\.js", "threejs"] },
  { name: "WebGL", patterns: ["webgl"] },
  { name: "Node.js", patterns: ["node\\.js", "nodejs", "\\bnode\\b"] },
  { name: "Python", patterns: ["\\bpython\\b"] },
];

export const SKILLS: DictionaryEntry[] = [
  // Collaboration / mindset
  { name: "Teamwork", patterns: ["team ?work", "work in (?:a )?team", "collaborative", "cross[- ]?functional"] },
  { name: "Communication", patterns: ["communication skills?", "strong communicat", "clearly communicat"] },
  { name: "Leadership", patterns: ["leadership", "lead a team", "leading teams?"] },
  { name: "Mentorship", patterns: ["mentor", "mentorship", "coaching"] },
  { name: "Stakeholder Management", patterns: ["stakeholder", "manage expectations"] },
  { name: "Presentation", patterns: ["present(ing|ation)", "pitch", "storytelling"] },
  { name: "Problem Solving", patterns: ["problem[- ]?solving", "solve complex"] },
  { name: "Critical Thinking", patterns: ["critical think"] },
  { name: "Strategic Thinking", patterns: ["strategic think", "strategy", "design strategy"] },
  { name: "Attention to Detail", patterns: ["attention to detail", "detail[- ]?oriented", "meticulous"] },
  { name: "Self-Starter", patterns: ["self[- ]?starter", "self[- ]?motivated", "proactive"] },
  { name: "Ownership", patterns: ["take ownership", "sense of ownership", "ownership mindset"] },
  { name: "Adaptability", patterns: ["adaptab", "flexible", "comfortable with change"] },
  { name: "Work Under Pressure", patterns: ["under pressure", "tight deadlines?", "high[- ]?pressure"] },
  { name: "Fast-Paced", patterns: ["fast[- ]?paced", "ship quickly", "rapid pace"] },
  { name: "Organization", patterns: ["organi[sz]ed", "organi[sz]ation skills?", "time management"] },
  { name: "Curiosity", patterns: ["curiou(s|sity)", "intellectually curious"] },
  { name: "Empathy", patterns: ["empath", "user empathy"] },

  // Craft / design
  { name: "Visual Design", patterns: ["visual design"] },
  { name: "Interaction Design", patterns: ["interaction design", "\\bIxD\\b"] },
  { name: "Motion Design", patterns: ["motion design", "motion graphics"] },
  { name: "Typography", patterns: ["typograph"] },
  { name: "Color Theory", patterns: ["color theory", "colour theory"] },
  { name: "Illustration", patterns: ["illustrat(ion|or)"] },
  { name: "Iconography", patterns: ["iconograph"] },
  { name: "Branding", patterns: ["brand identity", "brand system", "\\bbranding\\b"] },
  { name: "Art Direction", patterns: ["art direction"] },
  { name: "Information Architecture", patterns: ["information architecture", "\\bIA\\b"] },
  { name: "Wireframing", patterns: ["wireframe", "wireframing"] },
  { name: "Prototyping", patterns: ["prototyp"] },
  { name: "Design Systems", patterns: ["design system"] },
  { name: "Accessibility", patterns: ["accessibility", "\\ba11y\\b", "wcag"] },
  { name: "Responsive Design", patterns: ["responsive design", "responsive web"] },

  // Process / research
  { name: "User Research", patterns: ["user research", "\\bUXR\\b"] },
  { name: "Usability Testing", patterns: ["usability test"] },
  { name: "User Interviews", patterns: ["user interview"] },
  { name: "Data-Driven", patterns: ["data[- ]?driven", "data[- ]?informed"] },
  { name: "A/B Testing", patterns: ["a/?b test"] },
  { name: "Agile", patterns: ["\\bagile\\b", "\\bscrum\\b"] },
  { name: "Workshop Facilitation", patterns: ["facilitat(e|ing) workshop", "design sprint"] },

  // AI fluency
  { name: "AI Fluency", patterns: ["AI[- ]?fluent", "ai[- ]?native", "comfortable with AI tools", "leverage AI", "AI[- ]?powered workflows?"] },
  { name: "Prompt Engineering", patterns: ["prompt engineer", "prompt design"] },
];

/**
 * Compile a dictionary into [name, RegExp] tuples once. Each entry's patterns
 * are joined into a single alternation regex so a description is scanned once
 * per entry rather than once per pattern. Word boundaries are added around
 * patterns that don't already include them or contain regex meta — keeps
 * "ai" from matching "again" while still letting "(team ?work)" through.
 */
export function compileDictionary(dict: DictionaryEntry[]): [string, RegExp][] {
  return dict.map((e) => {
    const alts = e.patterns
      .map((p) => {
        // If the pattern already contains regex anchors/meta, trust it.
        if (/[\\\[\]\(\)\|\?\*\+\^\$]/.test(p)) return `(?:${p})`;
        return `\\b${p}\\b`;
      })
      .join("|");
    return [e.name, new RegExp(alts, "i")] as [string, RegExp];
  });
}
