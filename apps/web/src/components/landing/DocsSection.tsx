import type { FC } from "react";
import { useState } from "react";
import { BookOpen, Check, Copy, FileDiff, GitBranch, Settings2 } from "lucide-react";

type DocId = "connect" | "configure" | "review";

interface DocPage {
  id: DocId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  file: string;
  language: string;
  code: string;
  note: string;
  icon: FC<{ className?: string }>;
}

const DOC_PAGES: DocPage[] = [
  {
    id: "connect",
    label: "01 · Connect",
    eyebrow: "Repository access",
    title: "Install the GitHub App",
    description:
      "Choose only the repositories CommitScibble should read. A push webhook starts the analysis queue; no CI workflow file is required.",
    file: "terminal",
    language: "bash",
    code: `# Open the CommitScibble GitHub App installation
npx commitscibble connect

# Or trigger your first analysis from a local clone
npx commitscibble analyze --branch main`,
    note: "Private repository source is processed in an isolated worker and is never used to train public models.",
    icon: GitBranch,
  },
  {
    id: "configure",
    label: "02 · Configure",
    eyebrow: "Documentation targets",
    title: "Describe the output once",
    description:
      "Add a small configuration file when you need custom output paths, ignored directories, or repository-specific writing guidance.",
    file: "commitscibble.config.yml",
    language: "yaml",
    code: `version: 1
branch: main
outputs:
  readme: README.md
  architecture: docs/ARCHITECTURE.md
  api: docs/API.md
ignore:
  - dist/**
  - coverage/**
instructions: Document setup, environment variables, and public APIs.`,
    note: "Configuration is optional. CommitScibble infers sensible targets from your package manager and repository layout.",
    icon: Settings2,
  },
  {
    id: "review",
    label: "03 · Review",
    eyebrow: "Focused pull requests",
    title: "Inspect the patch, then merge",
    description:
      "Every change arrives as a normal GitHub pull request. Review the exact additions and deletions, request another pass, or merge when ready.",
    file: "patch-review.md",
    language: "diff",
    code: `branch: docs/commitscibble-update
files:
  - README.md             +42  -6
  - docs/API.md           +18  -0
checks:
  protected_branch: untouched
  source_files_modified: false
status: ready_for_review`,
    note: "CommitScibble only edits configured documentation files and never pushes directly to a protected branch.",
    icon: FileDiff,
  },
];

export const DocsSection: FC = () => {
  const [activeId, setActiveId] = useState<DocId>("connect");
  const [copied, setCopied] = useState(false);
  const activePage = DOC_PAGES.find((page) => page.id === activeId) ?? DOC_PAGES[0];

  const copyCode = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(activePage.code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = activePage.code;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section id="docs" className="relative w-full py-20 px-4 sm:px-6 overflow-hidden">
      <div className="max-w-[1240px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end mb-10">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#eeede6] text-[#251f19] text-[11px] font-medium mb-4">
              <BookOpen className="w-3.5 h-3.5 text-[#f48d16]" />
              Developer documentation
            </div>
            <h2 className="parley-h2">
              From install to your first
              <br />
              documentation patch.
            </h2>
          </div>
          <p className="lg:col-span-5 text-[15px] text-[#68615a] leading-relaxed max-w-[440px] lg:justify-self-end">
            A concise quickstart for connecting a repository, choosing documentation targets, and
            reviewing the focused pull request CommitScibble prepares.
          </p>
        </div>

        <div className="card p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
          <div className="lg:col-span-4 rounded-[16px] theme-soft border p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] theme-muted font-medium mb-4">
                Quickstart guide
              </div>
              <div className="space-y-2" role="tablist" aria-label="Documentation steps">
                {DOC_PAGES.map((page) => {
                  const active = activeId === page.id;
                  const Icon = page.icon;
                  return (
                    <button
                      key={page.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setActiveId(page.id);
                        setCopied(false);
                      }}
                      className={`w-full text-left p-3.5 rounded-[12px] border transition-all duration-300 cursor-pointer flex items-center gap-3 ${
                        active
                          ? "theme-surface shadow-[0_8px_20px_rgba(37,31,25,0.08)] border-[#f48d16]/60 translate-x-1"
                          : "border-transparent text-[#68615a] hover:bg-[var(--panel-solid)]"
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0 transition-colors ${
                          active ? "bg-[#f48d16] text-white" : "bg-[#eeede6] text-[#251f19]"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span>
                        <span className="block text-[11px] theme-muted mb-0.5">{page.label}</span>
                        <span className="block text-[13px] font-medium text-[#251f19]">
                          {page.title}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-6 pt-5 border-t theme-border text-[12px] theme-muted leading-relaxed">
              Need the bigger picture? See the{" "}
              <a href="#how-it-works" className="font-medium">
                worker pipeline
              </a>{" "}
              or read the{" "}
              <a href="#faq" className="font-medium">
                security FAQ
              </a>
              .
            </div>
          </div>

          <div className="lg:col-span-8 rounded-[16px] theme-surface border p-5 sm:p-7 min-w-0">
            <div key={activePage.id} className="content-swap">
              <div className="text-[11px] uppercase tracking-[0.12em] text-[#f48d16] font-medium mb-2">
                {activePage.eyebrow}
              </div>
              <h3 className="parley-h3 text-[24px] mb-2">{activePage.title}</h3>
              <p className="text-[14px] text-[#68615a] leading-relaxed max-w-[620px] mb-6">
                {activePage.description}
              </p>

              <div className="rounded-[14px] overflow-hidden bg-[#251f19] border border-white/10 shadow-[0_14px_28px_rgba(37,31,25,0.16)]">
                <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-[#f48d16] shrink-0" />
                    <span className="font-mono-code text-[11px] text-white/85 truncate">
                      {activePage.file}
                    </span>
                    <span className="hidden sm:inline px-1.5 py-0.5 rounded-[5px] bg-white/10 font-mono-code text-[10px] text-white/55">
                      {activePage.language}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[7px] bg-white/10 hover:bg-white/15 text-white text-[11px] transition-colors cursor-pointer"
                    aria-label={`Copy ${activePage.file} snippet`}
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="m-0 p-4 sm:p-5 overflow-x-auto font-mono-code text-[11px] sm:text-[12px] leading-[1.75] text-white/80 whitespace-pre">
                  <code>{activePage.code}</code>
                </pre>
              </div>

              <div className="mt-4 flex items-start gap-2.5 text-[12px] theme-muted leading-relaxed">
                <Check className="w-4 h-4 text-[#f48d16] shrink-0 mt-0.5" />
                <span>{activePage.note}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
