export type DiffOpType = "equal" | "insert" | "delete";

export interface DiffOp {
  type: DiffOpType;
  text: string;
  oldStart: number;
  newStart: number;
}

export function splitLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n");
  if (normalized === "") return [];
  const lines = normalized.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

const MAX_DP_CELLS = 4_000_000;

interface RawOp {
  type: DiffOpType;
  text: string;
}

export function diffLines(oldLines: string[], newLines: string[]): DiffOp[] {
  const raw = rawDiff(oldLines, newLines);
  let oldLine = 1;
  let newLine = 1;
  const ops: DiffOp[] = [];
  for (const op of raw) {
    ops.push({ type: op.type, text: op.text, oldStart: oldLine, newStart: newLine });
    if (op.type !== "insert") oldLine += 1;
    if (op.type !== "delete") newLine += 1;
  }
  return ops;
}

function rawDiff(a: string[], b: string[]): RawOp[] {
  const ops: RawOp[] = [];
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  for (let i = 0; i < start; i += 1) ops.push({ type: "equal", text: a[i] });

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  ops.push(...diffMiddle(midA, midB));

  for (let i = endA; i < a.length; i += 1) ops.push({ type: "equal", text: a[i] });
  return ops;
}

function diffMiddle(a: string[], b: string[]): RawOp[] {
  if (a.length === 0) return b.map((text) => ({ type: "insert", text }));
  if (b.length === 0) return a.map((text) => ({ type: "delete", text }));
  if (a.length * b.length > MAX_DP_CELLS) {
    return [
      ...a.map((text) => ({ type: "delete" as const, text })),
      ...b.map((text) => ({ type: "insert" as const, text })),
    ];
  }

  const rows = a.length + 1;
  const cols = b.length + 1;
  const table: Uint32Array[] = Array.from({ length: rows }, () => new Uint32Array(cols));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        a[i] === b[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const ops: RawOp[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ type: "equal", text: a[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ type: "delete", text: a[i] });
      i += 1;
    } else {
      ops.push({ type: "insert", text: b[j] });
      j += 1;
    }
  }
  while (i < a.length) {
    ops.push({ type: "delete", text: a[i] });
    i += 1;
  }
  while (j < b.length) {
    ops.push({ type: "insert", text: b[j] });
    j += 1;
  }
  return ops;
}

export interface UnifiedDiffOptions {
  context?: number;
  path?: string;
  oldPath?: string;
  newPath?: string;
}

export function createUnifiedDiff(
  oldText: string,
  newText: string,
  options: UnifiedDiffOptions = {},
): string {
  const context = options.context ?? 3;
  const ops = diffLines(splitLines(oldText), splitLines(newText));
  if (!ops.some((op) => op.type !== "equal")) return "";

  const changedIndexes: number[] = [];
  ops.forEach((op, index) => {
    if (op.type !== "equal") changedIndexes.push(index);
  });

  const ranges: { start: number; end: number }[] = [];
  for (const index of changedIndexes) {
    const start = Math.max(0, index - context);
    const end = Math.min(ops.length - 1, index + context);
    const last = ranges[ranges.length - 1];
    if (last && start <= last.end + 1) {
      last.end = Math.max(last.end, end);
    } else {
      ranges.push({ start, end });
    }
  }

  const filePath = options.path ?? "README.md";
  const oldPath = options.oldPath ?? `a/${filePath}`;
  const newPath = options.newPath ?? `b/${filePath}`;
  const lines: string[] = [`--- ${oldPath}`, `+++ ${newPath}`];

  for (const range of ranges) {
    const slice = ops.slice(range.start, range.end + 1);
    const oldCount = slice.filter((op) => op.type !== "insert").length;
    const newCount = slice.filter((op) => op.type !== "delete").length;
    const first = ops[range.start];
    const oldStart = oldCount === 0 ? Math.max(0, first.oldStart - 1) : first.oldStart;
    const newStart = newCount === 0 ? Math.max(0, first.newStart - 1) : first.newStart;
    lines.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    for (const op of slice) {
      const prefix = op.type === "equal" ? " " : op.type === "insert" ? "+" : "-";
      lines.push(`${prefix}${op.text}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function diffStats(
  oldText: string,
  newText: string,
): { additions: number; deletions: number } {
  const ops = diffLines(splitLines(oldText), splitLines(newText));
  return {
    additions: ops.filter((op) => op.type === "insert").length,
    deletions: ops.filter((op) => op.type === "delete").length,
  };
}

export function summarizeDiff(diff: string): string[] {
  return splitLines(diff).filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---)/.test(line));
}
