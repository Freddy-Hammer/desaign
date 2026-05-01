import { filterJob } from "./filter";

interface Case {
  title: string;
  department?: string | null;
  expected: boolean;
  note?: string;
}

// Real titles seen in Stage 1/2 dry runs, plus synthetic edge cases.
const CASES: Case[] = [
  // ===== INCLUDE — real designer roles =====
  { title: "Brand Designer, Product Demos", expected: true },
  { title: "Designer Advocate, Federal", expected: true },
  { title: "Designer Advocate - Figma Weave (New York, United States)", expected: true },
  { title: "Manager, Product Design", expected: true },
  { title: "Manager, Customer Education Design", department: "Design", expected: true },
  { title: "Product Designer, AI Models", expected: true },
  { title: "Product Designer - Design, Dev, & AI Tools", expected: true },
  { title: "Product Designer, Growth & Monetization", expected: true },
  { title: "Art Director, Enterprise", expected: true },
  { title: "Design Engineer, Web", expected: true, note: "engineer override" },
  { title: "Design Engineer, AI Capability Development (Education Labs)", expected: true, note: "engineer override" },
  { title: "Product Designer, Claude Code", expected: true },
  { title: "Experience Designer, Offline Design", expected: true },
  { title: "Staff Experience Designer", expected: true },
  { title: "Content Designer, Personalization", expected: true },
  { title: "Design Manager, Subscriptions", expected: true },
  { title: "Product Designer - Advertising", expected: true },
  { title: "Senior Product Designer - Platform Design", expected: true },
  { title: "Designer, Web & Brand", expected: true },
  { title: "Senior / Staff Product Designer", expected: true },
  { title: "Brand Designer", expected: true },
  { title: "Motion Designer", expected: true },
  { title: "Product Designer, ChatGPT", expected: true },
  { title: "Content Designer", expected: true },
  { title: "Product Designer, Growth", expected: true },
  { title: "Creative Director, Brand Identity", expected: true },
  { title: "Quantitative UX Researcher", expected: true, note: "UX present, conditional researcher allowed" },
  { title: "AI Conversation Designer, Customer Support", expected: true, note: "Designer wins over CS team" },
  { title: "Motion Designer, Brand", expected: true },
  { title: "Interactive Designer, Brand", expected: true },

  // ===== INCLUDE — synthetic edge cases =====
  { title: "Head of Design", expected: true },
  { title: "VP, Design", expected: true },
  { title: "Chief Design Officer", expected: true },
  { title: "Design Strategist", expected: true },
  { title: "Brand Strategist", expected: true },
  { title: "Design Operations Manager", expected: true, note: "design ops override" },
  { title: "Creative Marketing Lead", expected: true, note: "creative marketing override" },
  { title: "Service Designer, Healthcare", expected: true },
  { title: "UX Researcher", expected: true },
  { title: "Design Researcher", expected: true },
  { title: "Creative Technologist", expected: true, note: "engineer override" },
  { title: "Design Technologist", expected: true, note: "engineer override" },
  { title: "AI Specialist", department: "Design", expected: true, note: "ambiguous + Design dept" },
  { title: "Illustrator", expected: true },
  { title: "Senior Designer", expected: true },

  // ===== EXCLUDE — false-positives we observed in Stage 1/2 =====
  { title: "Software Engineer, UI Platform", expected: false },
  { title: "Engineering Manager, Identity Infrastructure", expected: false },
  { title: "Software Engineer, Identity Platform", expected: false },
  { title: "Software Engineer, Identity Infrastructure Engineering", expected: false },
  { title: "UI Software Engineer, Claude.ai Consumer Product", expected: false },
  { title: "Manager, Software Engineering - Design Systems Management", expected: false },
  { title: "Manager, Software Engineering - Interaction Design", expected: false },
  { title: "Engineering Manager, UI Tooling", expected: false },
  { title: "Senior Data Scientist, Platform - Identity/Algorithms", expected: false },
  { title: "Fullstack Engineer - Generative UI Platform", expected: false },
  { title: "Senior Fullstack Engineer – Generative UI Platform", expected: false },
  { title: "Senior Machine Learning Engineer - Generative UI Platform", expected: false },
  { title: "Design Verification Engineer", expected: false, note: "silicon, not UX" },
  { title: "Physical Design Engineer", expected: false, note: "silicon, not UX" },
  { title: "Data Center Design Execution Lead", expected: false, note: "facilities" },
  { title: "RTL & Co-design Engineer (junior)", expected: false, note: "silicon RTL design, not UX" },
  { title: "Product Manager, Design Tools", expected: false, note: "PM, not designer" },

  // Genuine policy-design Manager — brief lists 'design manager' as include,
  // so we keep this even though the team is policy-flavoured.
  { title: "Policy Design Manager, Age-Appropriate Design", expected: true, note: "design manager per brief include rule" },

  // Events Lead — not a designer or strategist; brief doesn't list it
  { title: "Events Lead, Brand", expected: false, note: "events role, not design" },

  // ===== EXCLUDE — clearly non-design =====
  { title: "Account Executive, Enterprise", expected: false },
  { title: "Customer Success Manager", expected: false },
  { title: "Recruiter, Engineering", expected: false },
  { title: "Senior Counsel, Privacy", expected: false },
  { title: "Sales Director, EMEA", expected: false },
  { title: "Marketing Manager, Growth", expected: false },
  { title: "User Researcher", expected: false, note: "no design/ux/creative qualifier" },
  { title: "Senior Software Engineer", expected: false },
  { title: "Frontend Engineer", expected: false },
  { title: "Backend Engineer", expected: false },
  { title: "Machine Learning Engineer", expected: false },
  { title: "AI Specialist", expected: false, note: "no dept hint" },
];

function main() {
  let pass = 0, fail = 0;
  const failures: { c: Case; reason: string; got: boolean }[] = [];

  for (const c of CASES) {
    const r = filterJob({ title: c.title, department: c.department ?? null });
    if (r.include === c.expected) {
      pass++;
    } else {
      fail++;
      failures.push({ c, reason: r.reason, got: r.include });
    }
  }

  console.log(`\nFilter test results: ${pass} pass / ${fail} fail (of ${CASES.length})\n`);

  if (failures.length > 0) {
    console.log("Failures:");
    for (const f of failures) {
      const expected = f.c.expected ? "INCLUDE" : "EXCLUDE";
      const got = f.got ? "INCLUDE" : "EXCLUDE";
      console.log(`  expected ${expected}, got ${got} [${f.reason}]`);
      console.log(`    title: "${f.c.title}"${f.c.department ? `  dept: "${f.c.department}"` : ""}${f.c.note ? `  (${f.c.note})` : ""}`);
    }
    process.exit(1);
  } else {
    console.log("All cases pass.");
  }
}

main();
