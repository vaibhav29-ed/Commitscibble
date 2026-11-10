import {
  SECTION_KEYS,
  SECTION_TITLES,
  slugifyHeading,
  splitSections,
  type GeneratedSection,
  type MarkdownSection,
  type ReadmeDraft,
  type SectionKey,
} from "@commitscibble/shared";

const SECTION_ORDER: SectionKey[] = [...SECTION_KEYS];

function normalizeBody(body: string, heading: string): string {
  const trimmed = body.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return "";
  const firstLine = trimmed.split("\n")[0];
  if (new RegExp(`^#{1,6}\\s+${escapeRegExp(heading)}\\s*$`, "i").test(firstLine)) {
    return trimmed.split("\n").slice(1).join("\n").trim();
  }
  return trimmed;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function orderSections(sections: GeneratedSection[]): GeneratedSection[] {
  const seen = new Set<SectionKey>();
  const unique = sections.filter((section) => {
    if (seen.has(section.key)) return false;
    seen.add(section.key);
    return true;
  });
  return unique.sort(
    (a, b) => SECTION_ORDER.indexOf(a.key) - SECTION_ORDER.indexOf(b.key),
  );
}

export function assembleReadme(draft: ReadmeDraft): string {
  const sections = orderSections(draft.sections);
  const parts: string[] = [`# ${draft.title.trim()}`, "", draft.summary.trim(), ""];
  for (const section of sections) {
    const body = normalizeBody(section.body, section.heading);
    if (!body) continue;
    const level = Math.min(4, Math.max(2, section.level));
    parts.push(`${"#".repeat(level)} ${section.heading.trim()}`, "", body, "");
  }
  return `${parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export function canonicalKeyForHeading(heading: string): SectionKey | null {
  const slug = slugifyHeading(heading);
  for (const key of SECTION_KEYS) {
    if (slug === key || slug === slugifyHeading(SECTION_TITLES[key])) return key;
  }
  const aliases: Record<string, SectionKey> = {
    "getting-started": "installation",
    setup: "installation",
    "quick-start": "installation",
    "tech-stack": "tech-stack",
    technologies: "tech-stack",
    stack: "tech-stack",
    "environment-variables": "configuration",
    config: "configuration",
    "api-reference": "api-reference",
    api: "api-reference",
    endpoints: "api-reference",
    tests: "testing",
    "running-tests": "testing",
    deployment: "deployment",
    deploy: "deployment",
    licence: "license",
    contributing: "contributing",
    architecture: "architecture",
    "project-structure": "architecture",
    overview: "overview",
    features: "features",
    usage: "usage",
    prerequisites: "prerequisites",
    requirements: "prerequisites",
    troubleshooting: "troubleshooting",
    security: "security",
  };
  return aliases[slug] ?? null;
}

export function findSectionByCanonicalKey(
  markdown: string,
  key: SectionKey,
): MarkdownSection | null {
  const split = splitSections(markdown);
  return split.sections.find((section) => canonicalKeyForHeading(section.heading) === key) ?? null;
}

export function extractCanonicalSections(
  markdown: string,
): { key: SectionKey; section: MarkdownSection }[] {
  const split = splitSections(markdown);
  const output: { key: SectionKey; section: MarkdownSection }[] = [];
  for (const section of split.sections) {
    const key = canonicalKeyForHeading(section.heading);
    if (key) output.push({ key, section });
  }
  return output;
}
