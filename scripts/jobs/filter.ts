import type { Job } from "./schema";

export interface FilterResult {
  include: boolean;
  reason: string;
}

// Hardware / silicon / facilities phrases — checked BEFORE the engineer
// override list, because phrases like "Physical Design Engineer" also contain
// the substring "design engineer" and would otherwise leak through.
const HARDWARE_EXCLUDES: RegExp[] = [
  /\bdata center\b/i,
  /\b(asic|fpga|silicon|semiconductor|hardware|rtl)\b/i,
  /\bphysical design\b/i,
  /\bverification engineer\b/i,
  /\bmechanical (engineer|design)\b/i,
  /\bco-?design engineer\b/i,
];

// Engineer-variant titles we DO want to keep (after hardware excludes)
const INCLUDE_OVERRIDES: RegExp[] = [
  /\bdesign engineer\b/i,
  /\bcreative engineer\b/i,
  /\bdesign technologist\b/i,
  /\bcreative technologist\b/i,
];

// Always exclude — engineering / data / business roles.
// These dominate even if the title also mentions "design".
const HARD_EXCLUDES: RegExp[] = [
  // Any remaining role with "engineer" or "engineering". This catches
  // Software/Backend/Frontend/ML/Data/UI/UX/Security/Infra engineers,
  // plus Engineering Manager / Engineering Lead.
  /\bengineer(ing|s)?\b/i,
  // Pure-data analytics roles
  /\bdata (scientist|analyst)\b/i,
  /\bquantitative researcher\b/i,
  // Business roles always out
  /\baccount (executive|manager|director)\b/i,
  /\bbusiness development\b/i,
  /\b(bdr|sdr)\b/i,
  /\b(legal counsel|general counsel|associate counsel)\b/i,
  /\baccountant\b/i,
];

// Stronger designer-relevant signals — if any matches, INCLUDE (after hard excludes).
const STRONG_INCLUDES: RegExp[] = [
  /\bdesigner\b/i,
  /\b(product|ux|ui|user\s+experience|user\s+interface|brand|visual|motion|graphic|interaction|experience|service|content|conversation|industrial|systems?|prompt|generative|ai|3d|game|web)\s+design(er|ing)?\b/i,
  /\bdesign\s+(systems?|director|manager|lead|principal|head|ops|operations|technologist|strategist)\b/i,
  /\b(art|creative)\s+(director|lead|manager|principal)\b/i,
  /\bcreative (director|lead|strategist|principal)\b/i,
  /\b(brand|visual)\s+(strategist|identity)\b/i,
  /\b(illustrator|type designer|typographer|copywriter)\b/i,
  /\b(head of|vp of|vice president of|chief)\s+(design|creative|brand)\b/i,
  /\b(vp|chief),?\s+(design|creative|brand)\b/i,
  /\bchief design officer\b/i,
  /\b(design|creative|brand)\s+(officer)\b/i,
  /\bux\b/i,
  /\bui\b/i,
];

// Conditional includes — only if title also has design/ux/creative context
function conditionalInclude(title: string): FilterResult | null {
  if (/\bresearcher\b/i.test(title) && /\b(design|ux|creative)\b/i.test(title)) {
    return { include: true, reason: "conditional:researcher+design" };
  }
  if (/\bprompt engineer\b/i.test(title) && /\b(design|creative)\b/i.test(title)) {
    return { include: true, reason: "conditional:prompt-engineer+design" };
  }
  return null;
}

// Soft excludes — skip these unless an override or strong include matched first
const SOFT_EXCLUDES: RegExp[] = [
  /\bsales\b/i,
  /\brecruit(er|ing)\b/i,
  /\b(human resources|people (operations|ops))\b/i,
  /\b(finance|tax|compliance|treasury)\b/i,
  /\bcustomer (support|success|experience)\b/i,
  /\b\boperations\b/i,
  /\bproduct manager\b/i,
  /\bprogram manager\b/i,
  /\bmarketing\b/i,
];

// Soft-exclude overrides — design-flavoured variants of soft-excluded roles
const SOFT_OVERRIDES: RegExp[] = [
  /\bdesign\s+(ops|operations)\b/i,
  /\bcreative\s+(ops|operations)\b/i,
  /\b(design|creative)\s+marketing\b/i,
  /\bdesign pm\b/i,
];

const DEPT_INCLUDE_HINTS = /^(design|creative|brand|product design|user experience|ux)\b/i;

export function filterJob(job: Pick<Job, "title" | "department">): FilterResult {
  const title = job.title;
  const department = job.department ?? "";

  // 1. Hardware / silicon / facilities — must come before the engineer
  //    override (e.g. "Physical Design Engineer" contains "Design Engineer").
  for (const re of HARDWARE_EXCLUDES) {
    if (re.test(title)) return { include: false, reason: `hardware:${re.source}` };
  }

  // 2. Engineer-variant whitelist
  for (const re of INCLUDE_OVERRIDES) {
    if (re.test(title)) return { include: true, reason: `override:${re.source}` };
  }

  // 3. Hard excludes (engineer / business / data)
  for (const re of HARD_EXCLUDES) {
    if (re.test(title)) return { include: false, reason: `hard:${re.source}` };
  }

  // 4. Strong designer signals
  for (const re of STRONG_INCLUDES) {
    if (re.test(title)) return { include: true, reason: `strong:${re.source}` };
  }

  // 5. Conditional includes
  const cond = conditionalInclude(title);
  if (cond) return cond;

  // 6. Soft-exclude overrides
  for (const re of SOFT_OVERRIDES) {
    if (re.test(title)) return { include: true, reason: `soft-override:${re.source}` };
  }

  // 7. Soft excludes
  for (const re of SOFT_EXCLUDES) {
    if (re.test(title)) return { include: false, reason: `soft:${re.source}` };
  }

  // 8. Department tie-breaker
  if (DEPT_INCLUDE_HINTS.test(department)) {
    return { include: true, reason: `dept:${department}` };
  }

  // 9. Default exclude
  return { include: false, reason: "default-exclude" };
}
