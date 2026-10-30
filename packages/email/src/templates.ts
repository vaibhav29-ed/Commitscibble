import type { EmailMessage } from "./index.js";

export interface RepositoryEmailContext {
  repositoryFullName: string;
  repositoryHtmlUrl: string;
  runId: string;
  appUrl: string;
}

export interface ReviewRequiredInput extends RepositoryEmailContext {
  summary: string;
  additions: number;
  deletions: number;
  provider: string | null;
  model: string | null;
}

export interface AppliedInput extends RepositoryEmailContext {
  branch: string;
  readmePath: string;
  commitSha: string | null;
}

export interface FailedInput extends RepositoryEmailContext {
  code: string;
  message: string;
}

function baseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout(title: string, paragraphs: string[], cta: { label: string; href: string }): string {
  const body = paragraphs.map((paragraph) => `<p style="margin:0 0 12px">${paragraph}</p>`).join("");
  return [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#111;max-width:560px">',
    `<h2 style="font-size:18px;margin:0 0 16px">${escapeHtml(title)}</h2>`,
    body,
    `<p style="margin:20px 0 0"><a href="${escapeHtml(cta.href)}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">${escapeHtml(cta.label)}</a></p>`,
    '<p style="margin:24px 0 0;font-size:12px;color:#666">Sent by CommitScibble. You can manage repository tracking from your dashboard.</p>',
    "</div>",
  ].join("");
}

export function reviewRequiredEmail(input: ReviewRequiredInput): EmailMessage {
  const reviewUrl = `${baseUrl(input.appUrl)}/dashboard/reviews/${input.runId}`;
  const provider = [input.provider, input.model].filter(Boolean).join("/") || "the configured AI provider";
  const summary = input.summary.trim() || "A new documentation proposal is ready.";
  const stats = `+${input.additions} / -${input.deletions} lines`;
  const text = [
    `A documentation proposal is ready for ${input.repositoryFullName}.`,
    "",
    summary,
    `Change size: ${stats}`,
    `Generated with: ${provider}`,
    "",
    `Review and approve it: ${reviewUrl}`,
    "",
    "Nothing is written to GitHub until you approve the proposal.",
  ].join("\n");

  return {
    to: "",
    subject: `[CommitScibble] Review needed for ${input.repositoryFullName}`,
    text,
    html: layout(
      `Review needed for ${input.repositoryFullName}`,
      [
        escapeHtml(summary),
        `Change size: <strong>${escapeHtml(stats)}</strong>`,
        `Generated with <strong>${escapeHtml(provider)}</strong>. Nothing is written to GitHub until you approve the proposal.`,
      ],
      { label: "Review proposal", href: reviewUrl },
    ),
  };
}

export function documentationAppliedEmail(input: AppliedInput): EmailMessage {
  const repositoryUrl = `${baseUrl(input.repositoryHtmlUrl)}/blob/${encodeURIComponent(input.branch)}/${input.readmePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
  const commitUrl = input.commitSha
    ? `${baseUrl(input.repositoryHtmlUrl)}/commit/${input.commitSha}`
    : null;
  const dashboardUrl = `${baseUrl(input.appUrl)}/dashboard/repositories`;
  const text = [
    `CommitScibble updated ${input.readmePath} in ${input.repositoryFullName}.`,
    "",
    `Branch: ${input.branch}`,
    commitUrl ? `Commit: ${commitUrl}` : "The README already matched the generated content; no commit was created.",
    "",
    `Open the README: ${repositoryUrl}`,
    `Dashboard: ${dashboardUrl}`,
  ].join("\n");

  return {
    to: "",
    subject: `[CommitScibble] README updated for ${input.repositoryFullName}`,
    text,
    html: layout(
      `README updated for ${input.repositoryFullName}`,
      [
        `CommitScibble updated <code>${escapeHtml(input.readmePath)}</code> on branch <code>${escapeHtml(input.branch)}</code>.`,
        commitUrl
          ? `Commit: <a href="${escapeHtml(commitUrl)}">${escapeHtml(input.commitSha ?? "")}</a>`
          : "The README already matched the generated content; no commit was created.",
      ],
      { label: "Open README", href: repositoryUrl },
    ),
  };
}

export function runFailedEmail(input: FailedInput): EmailMessage {
  const runUrl = `${baseUrl(input.appUrl)}/dashboard/activity`;
  const message = input.message.trim() || "The documentation run failed.";
  const text = [
    `A documentation run failed for ${input.repositoryFullName}.`,
    "",
    `Reason: ${message}`,
    `Error code: ${input.code}`,
    "",
    `Inspect the run and retry: ${runUrl}`,
  ].join("\n");

  return {
    to: "",
    subject: `[CommitScibble] Documentation run failed for ${input.repositoryFullName}`,
    text,
    html: layout(
      `Documentation run failed for ${input.repositoryFullName}`,
      [
        `Reason: <strong>${escapeHtml(message)}</strong>`,
        `Error code: <code>${escapeHtml(input.code)}</code>`,
        "The README was not changed. You can inspect the audit trail and retry the operation from the dashboard.",
      ],
      { label: "Inspect activity", href: runUrl },
    ),
  };
}
