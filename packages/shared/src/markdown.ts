export interface MarkdownHeading {
  level: number;
  text: string;
  line: number;
  slug: string;
}

export interface MarkdownSection {
  key: string;
  heading: string;
  level: number;
  startIndex: number;
  endIndex: number;
  body: string;
}

export interface SplitMarkdown {
  preamble: string;
  sections: MarkdownSection[];
  headings: MarkdownHeading[];
}

const FENCE_PATTERN = /^\s*(`{3,}|~{3,})/;

export function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
  return slug.length > 0 ? slug : "section";
}

export function parseHeadings(markdown: string): MarkdownHeading[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const headings: MarkdownHeading[] = [];
  let fence: { char: string; length: number } | null = null;

  lines.forEach((line, index) => {
    const fenceMatch = line.match(FENCE_PATTERN);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fence) {
        fence = { char: marker[0], length: marker.length };
      } else if (marker[0] === fence.char && marker.length >= fence.length) {
        fence = null;
      }
      return;
    }
    if (fence) return;
    const headingMatch = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (!headingMatch) return;
    const text = headingMatch[2].trim();
    if (text.length === 0) return;
    headings.push({
      level: headingMatch[1].length,
      text,
      line: index,
      slug: slugifyHeading(text),
    });
  });

  return headings;
}

function lineStartOffsets(markdown: string): number[] {
  const offsets = [0];
  for (let i = 0; i < markdown.length; i += 1) {
    if (markdown[i] === "\n") offsets.push(i + 1);
  }
  return offsets;
}

export function splitSections(markdown: string): SplitMarkdown {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const headings = parseHeadings(normalized);
  const offsets = lineStartOffsets(normalized);
  const bodyStart = normalized.endsWith("\n") ? normalized.length : normalized.length;

  if (headings.length === 0) {
    return { preamble: normalized, sections: [], headings };
  }

  const minimumLevel = Math.min(...headings.map((heading) => heading.level));
  const hasSecondLevel = headings.some((heading) => heading.level === 2);
  const sectionLevel = minimumLevel === 1 ? (hasSecondLevel ? 2 : 1) : minimumLevel;
  const starts = headings.filter((heading) => heading.level === sectionLevel);
  if (starts.length === 0) {
    return { preamble: normalized, sections: [], headings };
  }

  const usedKeys = new Map<string, number>();
  const sections: MarkdownSection[] = starts.map((heading, index) => {
    const startIndex = offsets[heading.line] ?? 0;
    const next = starts[index + 1];
    const endIndex = next ? (offsets[next.line] ?? normalized.length) : bodyStart;
    const count = usedKeys.get(heading.slug) ?? 0;
    usedKeys.set(heading.slug, count + 1);
    const key = count === 0 ? heading.slug : `${heading.slug}-${count + 1}`;
    return {
      key,
      heading: heading.text,
      level: heading.level,
      startIndex,
      endIndex,
      body: normalized.slice(startIndex, endIndex),
    };
  });

  return {
    preamble: normalized.slice(0, sections[0].startIndex),
    sections,
    headings,
  };
}

export function reassembleMarkdown(split: SplitMarkdown, replacements?: Map<string, string>): string {
  if (split.sections.length === 0) return replacements?.get("__document__") ?? split.preamble;
  let output = split.preamble;
  for (const section of split.sections) {
    output += replacements?.get(section.key) ?? section.body;
  }
  return output;
}

export function replaceSectionBodies(
  markdown: string,
  replacements: Record<string, string>,
): string {
  const split = splitSections(markdown);
  const byKey = new Map(split.sections.map((section) => [section.key, section]));
  const map = new Map<string, string>();

  for (const [key, body] of Object.entries(replacements)) {
    const section = byKey.get(key);
    if (!section) throw new Error(`Unknown README section: ${key}`);
    const bodyHeading = body.match(/^(#{1,6})\s+(.*?)\s*$/m);
    if (!bodyHeading) {
      throw new Error(`Replacement for section "${key}" must start with a Markdown heading`);
    }
    if (bodyHeading[1].length !== section.level) {
      throw new Error(
        `Replacement for section "${key}" must use heading level ${section.level}`,
      );
    }
    map.set(key, body.endsWith("\n") ? body : `${body}\n`);
  }

  return reassembleMarkdown(split, map);
}

export function findDuplicateHeadings(markdown: string): string[] {
  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  for (const heading of parseHeadings(markdown)) {
    const count = (seen.get(heading.slug) ?? 0) + 1;
    seen.set(heading.slug, count);
    if (count > 1) duplicates.push(heading.text);
  }
  return [...new Set(duplicates)];
}

export function findHeadingLevelJumps(markdown: string): { from: string; to: string }[] {
  const jumps: { from: string; to: string }[] = [];
  const headings = parseHeadings(markdown);
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i].level > headings[i - 1].level + 1) {
      jumps.push({ from: headings[i - 1].text, to: headings[i].text });
    }
  }
  return jumps;
}

export function extractRelativeLinks(markdown: string): { text: string; href: string }[] {
  const links: { text: string; href: string }[] = [];
  const pattern = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const stripped = markdown.replace(/```[\s\S]*?```/g, "");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(stripped)) !== null) {
    const href = match[2];
    if (/^(https?:|mailto:|#)/i.test(href)) continue;
    const clean = href.split("#")[0];
    if (clean.length === 0) continue;
    links.push({ text: match[1], href: clean });
  }
  return links;
}
