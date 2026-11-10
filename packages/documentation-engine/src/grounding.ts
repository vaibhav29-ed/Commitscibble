import type { GeneratedSection } from "@commitscibble/shared";

export interface SectionGrounding {
  key: string;
  heading: string;
  declared: string[];
  verified: string[];
  unsupported: string[];
  grounded: boolean;
}

export interface EvidenceAuditResult {
  sections: SectionGrounding[];
  unsupportedPaths: string[];
  ungroundedSections: string[];
  warnings: string[];
  feedback: string[];
  needsRepair: boolean;
  summary: string;
}

export interface EvidenceAuditOptions {
  knownPaths: Set<string>;
  inventoryTruncated?: boolean;
}

const MAX_WARNINGS = 12;

function normalizeCitation(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/\*\*?$/, "")
    .replace(/\/+$/, "");
}

function isPathClaim(citation: string): boolean {
  return citation.includes("/") || /\.[a-z0-9]{1,12}$/i.test(citation);
}

function buildDirectoryIndex(paths: Iterable<string>): Set<string> {
  const directories = new Set<string>();
  for (const path of paths) {
    const parts = path.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      directories.add(parts.slice(0, index).join("/"));
    }
  }
  return directories;
}

export function auditEvidenceGrounding(
  sections: GeneratedSection[],
  options: EvidenceAuditOptions,
): EvidenceAuditResult {
  const directories = buildDirectoryIndex(options.knownPaths);
  const unsupportedPaths = new Set<string>();
  const results: SectionGrounding[] = [];
  const warnings: string[] = [];
  const feedback: string[] = [];

  for (const section of sections) {
    const declared = [
      ...new Set(section.evidence.map(normalizeCitation).filter((citation) => citation.length > 0)),
    ];
    const verified: string[] = [];
    const unsupported: string[] = [];

    for (const citation of declared) {
      if (!isPathClaim(citation)) continue;
      if (options.knownPaths.has(citation) || directories.has(citation)) {
        verified.push(citation);
      } else {
        unsupported.push(citation);
      }
    }

    if (unsupported.length > 0) {
      for (const path of unsupported) unsupportedPaths.add(path);
      warnings.push(
        `Section "${section.heading}" cites paths that are not in the repository: ${unsupported.join(", ")}.`,
      );
      if (!options.inventoryTruncated) {
        feedback.push(
          `Section "${section.heading}" cites ${unsupported.join(", ")}, which do not exist in the repository. Remove those citations and any claim that depends on them.`,
        );
      }
    }

    if (verified.length === 0 && unsupported.length === 0) {
      warnings.push(
        `Section "${section.heading}" cites no repository evidence; confirm its content before applying.`,
      );
    }

    results.push({
      key: section.key,
      heading: section.heading,
      declared,
      verified,
      unsupported,
      grounded: verified.length > 0,
    });
  }

  const groundedCount = results.filter((section) => section.grounded).length;
  const ungroundedSections = results
    .filter((section) => !section.grounded)
    .map((section) => section.heading);

  return {
    sections: results,
    unsupportedPaths: [...unsupportedPaths],
    ungroundedSections,
    warnings: warnings.slice(0, MAX_WARNINGS),
    feedback,
    needsRepair: feedback.length > 0,
    summary:
      results.length === 0
        ? "No documentation sections were produced."
        : `Evidence grounding: ${groundedCount}/${results.length} section(s) cite verifiable repository files${
            unsupportedPaths.size > 0
              ? `; ${unsupportedPaths.size} cited path(s) do not exist`
              : ""
          }.`,
  };
}
