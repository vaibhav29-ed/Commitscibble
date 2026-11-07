import { useEffect, useMemo, useRef, useState } from "react";
import { SECTION_TITLES, isSectionKey } from "@commitscibble/shared";
import { cn } from "../lib/cn";

type DiffLineKind = "add" | "remove" | "context";

export interface ReviewDiffLine {
  kind: DiffLineKind;
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface ReviewDiffGroup {
  id: string;
  label: string;
  lines: ReviewDiffLine[];
  additions: number;
  deletions: number;
  firstLine: number | null;
  lastLine: number | null;
}

export interface ParsedReviewDiff {
  filePath: string | null;
  groups: ReviewDiffGroup[];
  additions: number;
  deletions: number;
}

interface DiffHunk {
  newStart: number;
  lines: ReviewDiffLine[];
  additions: number;
  deletions: number;
}

const HUNK_PATTERN = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

function sectionTitle(value: string): string {
  return isSectionKey(value) ? SECTION_TITLES[value] : value;
}

function cleanHeading(value: string): string {
  return value
    .replace(/#+\s*$/, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadings(markdown: string): { line: number; title: string }[] {
  const headings: { line: number; title: string }[] = [];
  let fence: string | null = null;

  markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .forEach((line, index) => {
      const fenceMatch = line.match(/^\s*(```+|~~~+)/);
      if (fenceMatch) {
        const marker = fenceMatch[1][0];
        if (!fence) {
          fence = marker;
        } else if (fence === marker) {
          fence = null;
        }
        return;
      }
      if (fence) return;

      const match = line.match(HEADING_PATTERN);
      if (match) headings.push({ line: index + 1, title: cleanHeading(match[2]) });
    });

  return headings;
}

function parseDiffPath(value: string): string {
  return value.trim().split("\t")[0].replace(/^[ab]\//, "");
}

function lineSpan(lines: ReviewDiffLine[]): { firstLine: number | null; lastLine: number | null } {
  let first: number | null = null;
  let last: number | null = null;

  for (const line of lines) {
    if (line.newLine === null) continue;
    if (first === null || line.newLine < first) first = line.newLine;
    if (last === null || line.newLine > last) last = line.newLine;
  }

  return { firstLine: first, lastLine: last };
}

interface DiffSection {
  label: string | null;
  newStart: number;
  lines: ReviewDiffLine[];
  additions: number;
  deletions: number;
}

function splitHunkIntoSections(hunk: DiffHunk): DiffSection[] {
  const sections: DiffSection[] = [];
  let current: DiffSection | null = null;
  let fence: string | null = null;

  for (const line of hunk.lines) {
    const fenceMatch = line.text.match(/^\s*(```+|~~~+)/);
    let heading: RegExpMatchArray | null = null;

    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) {
        fence = marker;
      } else if (fence === marker) {
        fence = null;
      }
    } else if (!fence) {
      heading = line.text.match(HEADING_PATTERN);
    }

    if (heading) {
      if (current) sections.push(current);
      current = {
        label: cleanHeading(heading[2]),
        newStart: line.newLine ?? hunk.newStart,
        lines: [],
        additions: 0,
        deletions: 0,
      };
    } else if (!current) {
      current = {
        label: null,
        newStart: line.newLine ?? hunk.newStart,
        lines: [],
        additions: 0,
        deletions: 0,
      };
    }

    if (!current) continue;
    current.lines.push(line);
    if (line.kind === "add") current.additions += 1;
    if (line.kind === "remove") current.deletions += 1;
  }

  if (current) sections.push(current);
  return sections;
}

/**
 * Split a unified diff into reviewable sections. When the proposed document is
 * available, each hunk borrows the nearest markdown heading so the rail reads
 * like the document rather than an anonymous list of ranges.
 */
export function parseReviewDiff(
  diff: string,
  proposedContent = "",
  sections: string[] = [],
): ParsedReviewDiff {
  const normalized = diff.replace(/\r\n/g, "\n");
  if (!normalized.trim()) return { filePath: null, groups: [], additions: 0, deletions: 0 };

  const headings = extractHeadings(proposedContent);
  const lines = normalized.split("\n");
  const hunks: DiffHunk[] = [];
  let filePath: string | null = null;
  let current: DiffHunk | null = null;
  let oldNumber = 0;
  let newNumber = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!current) {
      if (line.startsWith("+++ ")) {
        filePath = parseDiffPath(line.slice(4));
        continue;
      }
      if (line.startsWith("--- ") || line.startsWith("diff ")) continue;
    }

    const hunkMatch = line.match(HUNK_PATTERN);
    if (hunkMatch) {
      if (current) hunks.push(current);
      oldNumber = Number(hunkMatch[1]);
      newNumber = Number(hunkMatch[2]);
      current = { newStart: newNumber, lines: [], additions: 0, deletions: 0 };
      continue;
    }

    if (!current) continue;

    if (line.startsWith("+")) {
      current.lines.push({
        kind: "add",
        text: line.slice(1),
        oldLine: null,
        newLine: newNumber,
      });
      newNumber += 1;
      current.additions += 1;
    } else if (line.startsWith("-")) {
      current.lines.push({
        kind: "remove",
        text: line.slice(1),
        oldLine: oldNumber,
        newLine: null,
      });
      oldNumber += 1;
      current.deletions += 1;
    } else if (line.startsWith("\\")) {
      continue;
    } else {
      current.lines.push({
        kind: "context",
        text: line.startsWith(" ") ? line.slice(1) : line,
        oldLine: oldNumber,
        newLine: newNumber,
      });
      oldNumber += 1;
      newNumber += 1;
    }
  }

  if (current) hunks.push(current);

  const segments: DiffSection[] = [];
  for (const hunk of hunks) {
    let pendingContext: ReviewDiffLine[] = [];

    for (const section of splitHunkIntoSections(hunk)) {
      if (section.additions + section.deletions === 0) {
        pendingContext.push(...section.lines);
        continue;
      }

      segments.push({
        ...section,
        lines: [...pendingContext, ...section.lines],
      });
      pendingContext = [];
    }

    if (pendingContext.length > 0 && segments.length > 0) {
      segments[segments.length - 1].lines.push(...pendingContext);
    }
  }

  const groups: ReviewDiffGroup[] = [];

  segments.forEach((section, index) => {
    let label = section.label;

    if (!label && headings.length > 0) {
      const target = Math.max(1, section.newStart);
      for (const heading of headings) {
        if (heading.line > target) break;
        label = heading.title;
      }
    }

    if (!label && sections.length === 1) label = sectionTitle(sections[0]);
    if (!label && sections.length === segments.length) label = sectionTitle(sections[index]);
    if (!label) label = `Change ${index + 1}`;

    const previous = groups[groups.length - 1];
    if (previous && previous.label === label) {
      previous.lines.push(...section.lines);
      previous.additions += section.additions;
      previous.deletions += section.deletions;
      Object.assign(previous, lineSpan(previous.lines));
      return;
    }

    groups.push({
      id: `diff-section-${index + 1}`,
      label,
      lines: section.lines,
      additions: section.additions,
      deletions: section.deletions,
      ...lineSpan(section.lines),
    });
  });

  return {
    filePath,
    groups,
    additions: groups.reduce((total, group) => total + group.additions, 0),
    deletions: groups.reduce((total, group) => total + group.deletions, 0),
  };
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

export function ReviewCockpit({
  diff,
  proposedContent,
  sections,
  className,
}: {
  diff: string;
  proposedContent: string;
  sections: string[];
  className?: string;
}) {
  const parsed = useMemo(
    () => parseReviewDiff(diff, proposedContent, sections),
    [diff, proposedContent, sections],
  );
  const groups = parsed.groups;
  const [active, setActive] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lockRef = useRef<number | null>(null);
  const lockTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setActive(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [diff]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || groups.length === 0) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      if (lockRef.current !== null) return;
      const threshold = container.getBoundingClientRect().top + 12;
      let next = 0;

      for (let index = 0; index < groups.length; index += 1) {
        const element = groupRefs.current[index];
        if (element && element.getBoundingClientRect().top <= threshold) next = index;
      }
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 4) {
        next = groups.length - 1;
      }

      setActive(next);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    container.addEventListener("scroll", schedule, { passive: true });
    schedule();

    return () => {
      container.removeEventListener("scroll", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [groups.length, parsed.groups]);

  useEffect(
    () => () => {
      if (lockTimer.current) window.clearTimeout(lockTimer.current);
    },
    [],
  );

  if (groups.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border bg-muted/40 p-6 text-center text-sm leading-relaxed text-muted-foreground",
          className,
        )}
      >
        The proposed documentation is identical to the current README.
      </div>
    );
  }

  const activeGroup = groups[Math.min(active, groups.length - 1)];
  const progress = ((Math.min(active, groups.length - 1) + 1) / groups.length) * 100;

  const selectGroup = (index: number) => {
    const container = scrollRef.current;
    const element = groupRefs.current[index];
    if (!container || !element) return;

    setActive(index);
    lockRef.current = index;
    if (lockTimer.current) window.clearTimeout(lockTimer.current);
    lockTimer.current = window.setTimeout(
      () => {
        lockRef.current = null;
      },
      reducedMotion ? 40 : 520,
    );

    const top =
      element.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;

    container.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <div
      className={cn(
        "grid min-w-0 gap-4 lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start",
        className,
      )}
    >
      <aside className="min-w-0 lg:sticky lg:top-4">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2 border-b border-border pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Diff map
            </p>
            <p className="font-mono text-xs tabular-nums">
              <span className="text-accent">
                {String(Math.min(active + 1, groups.length)).padStart(2, "0")}
              </span>
              <span className="text-muted-foreground"> / {String(groups.length).padStart(2, "0")}</span>
            </p>
          </div>
          <div className="mb-2 mt-2 h-0.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300 ease-smooth motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <nav
            aria-label="Diff sections"
            className="flex w-full min-w-0 gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:divide-y lg:divide-border/60 lg:overflow-visible lg:pb-0"
          >
            {groups.map((group, index) => {
              const isActive = index === Math.min(active, groups.length - 1);
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => selectGroup(index)}
                  aria-current={isActive ? "location" : undefined}
                  aria-label={`${group.label}, ${group.additions} additions, ${group.deletions} deletions`}
                  className={cn(
                    "group flex h-11 min-w-[9.5rem] shrink-0 items-center gap-2 rounded-md px-1.5 text-left transition-colors duration-150 lg:h-12 lg:w-full lg:min-w-0 lg:rounded-none lg:px-2",
                    isActive ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid h-8 w-8 shrink-0 origin-center place-items-center font-display text-[1.5rem] leading-none tabular-nums transition-[transform,color] duration-200 ease-smooth motion-reduce:transition-none",
                      isActive
                        ? "scale-100 text-accent"
                        : "scale-50 text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[13px] leading-tight",
                      isActive
                        ? "font-medium text-foreground"
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    {group.label}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-2xs tabular-nums",
                      isActive ? "text-foreground/75" : "text-muted-foreground",
                    )}
                  >
                    <span className="text-success">+{group.additions}</span>{" "}
                    <span className="text-danger">−{group.deletions}</span>
                  </span>
                </button>
              );
            })}
          </nav>
          <p className="mt-3 hidden border-t border-border pt-2 font-mono text-2xs tabular-nums text-muted-foreground lg:block">
            {activeGroup.firstLine !== null
              ? `Lines ${activeGroup.firstLine}–${activeGroup.lastLine}`
              : "Select a section to jump through the change."}
          </p>
        </div>
      </aside>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2.5">
          <span className="truncate font-mono text-2xs text-muted-foreground">
            {parsed.filePath ?? "README.md"}
          </span>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            <span className="text-success">+{parsed.additions}</span>{" "}
            <span className="text-danger">−{parsed.deletions}</span>
          </span>
        </div>
        <div
          ref={scrollRef}
          role="region"
          aria-label="Unified diff"
          tabIndex={0}
          className="max-h-[70vh] min-w-0 overflow-auto bg-code-bg"
        >
          {groups.map((group, index) => {
            const isActive = index === Math.min(active, groups.length - 1);
            return (
              <div
                key={group.id}
                ref={(element) => {
                  groupRefs.current[index] = element;
                }}
                data-active={isActive ? "true" : "false"}
                className="relative border-t border-border/60 first:border-t-0"
              >
                <div className="sticky top-0 z-10 border-b border-border bg-code-bg px-4 py-2">
                  <div className="flex items-baseline gap-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        "font-display text-sm leading-none tabular-nums transition-colors duration-200 motion-reduce:transition-none",
                        isActive ? "text-accent" : "text-muted-foreground",
                      )}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3
                      className={cn(
                        "truncate text-[13px] font-semibold leading-tight",
                        isActive ? "text-accent" : "text-foreground",
                      )}
                    >
                      {group.label}
                    </h3>
                    {group.firstLine !== null ? (
                      <span className="hidden shrink-0 font-mono text-2xs tabular-nums text-muted-foreground sm:inline">
                        L{group.firstLine}–{group.lastLine}
                      </span>
                    ) : null}
                    <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-muted-foreground">
                      <span className="text-success">+{group.additions}</span>{" "}
                      <span className="text-danger">−{group.deletions}</span>
                    </span>
                  </div>
                </div>
                <div className="font-mono text-xs leading-5">
                  {group.lines.map((line) => (
                    <div
                      key={`${line.oldLine ?? "x"}-${line.newLine ?? "x"}-${line.kind}-${line.text.slice(0, 12)}`}
                      data-tone={line.kind}
                      className={cn(
                        "flex",
                        line.kind === "add" && "bg-success/10 text-success",
                        line.kind === "remove" && "bg-danger/10 text-danger",
                        line.kind === "context" && "text-foreground/90",
                      )}
                    >
                      <span className="w-10 shrink-0 select-none border-r border-border/60 px-2 text-right text-2xs tabular-nums text-muted-foreground">
                        {line.oldLine ?? ""}
                      </span>
                      <span className="w-10 shrink-0 select-none border-r border-border/60 px-2 text-right text-2xs tabular-nums text-muted-foreground">
                        {line.newLine ?? ""}
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          "w-5 shrink-0 select-none text-center",
                          line.kind === "add" && "text-success",
                          line.kind === "remove" && "text-danger",
                          line.kind === "context" && "text-muted-foreground",
                        )}
                      >
                        {line.kind === "add" ? "+" : line.kind === "remove" ? "−" : " "}
                      </span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap break-all pr-4">
                        {line.text || " "}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
