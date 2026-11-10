import type { FC, FormEvent } from "react";
import { useState } from "react";
import {
  GitBranch,
  GitPullRequest,
  Sparkles,
  FolderGit2,
  Cpu,
  Database,
  CheckCircle2,
  Send,
  FileCode2,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";

const HERO_BG_URL = "/brand/landing/hero-bg.png";

interface TaskItem {
  id: string;
  repo: string;
  title: string;
  branch: string;
  workerNode: string;
  diffTitle: string;
  diffLines: { type: "add" | "del" | "ctx"; text: string }[];
  status: string;
}

const REPO_TASKS: TaskItem[] = [
  {
    id: "readme-sync",
    repo: "commitscibble/core-engine",
    title: "Generate README.md architecture & setup patch",
    branch: "feat/redis-worker-pipeline",
    workerNode: "worker-us-east-04 (Redis + Express)",
    diffTitle: "README.md (+24, -4)",
    status: "Patch Ready • PR #142",
    diffLines: [
      { type: "ctx", text: "## Asynchronous Worker Architecture" },
      { type: "del", text: "- Documentation is updated manually after sprint releases." },
      {
        type: "add",
        text: "+ Express webhook dispatches Git push events to Redis queue (`bullmq:repo-sync`).",
      },
      {
        type: "add",
        text: "+ Dedicated background workers clone, build TypeScript AST, and index in MongoDB.",
      },
      {
        type: "add",
        text: "+ AI synthesis engine generates context-aware README.md and API route diffs.",
      },
    ],
  },
  {
    id: "api-routes",
    repo: "commitscibble/api-gateway",
    title: "Document Express REST endpoints & MongoDB schemas",
    branch: "docs/express-route-manifest",
    workerNode: "worker-eu-west-02 (MongoDB + TS)",
    diffTitle: "docs/API_REFERENCE.md (+38, -2)",
    status: "Verified AST • PR #89",
    diffLines: [
      { type: "ctx", text: "### POST /api/v1/repos/:owner/:repo/analyze" },
      { type: "del", text: "- Accepts repository string and returns basic file count." },
      { type: "add", text: "+ Enqueues deep repository AST analysis into Redis worker pool." },
      {
        type: "add",
        text: "+ Persists file dependency graph & symbol metadata in MongoDB `repoSnapshots`.",
      },
      {
        type: "add",
        text: "+ Returns `jobId`, `estimatedTokens`, and webhook stream channel.",
      },
    ],
  },
  {
    id: "changelog-patch",
    repo: "commitscibble/web-dashboard",
    title: "Synthesize React + Tailwind component changelog",
    branch: "chore/ui-docs-sync",
    workerNode: "worker-us-west-01 (AST Parser)",
    diffTitle: "CHANGELOG.md (+19, -0)",
    status: "Synced • PR #204",
    diffLines: [
      { type: "ctx", text: "## [2.4.0] - Automated Documentation Release" },
      { type: "add", text: "+ Added real-time Redis worker queue monitor in Dashboard sidebar." },
      {
        type: "add",
        text: "+ Integrated GitHub OAuth installation flow with fine-grained repo scopes.",
      },
      { type: "add", text: "+ Automated one-click PR creation for README.md & ARCHITECTURE.md." },
    ],
  },
];

interface HeroSectionProps {
  connectHref: string;
}

export const HeroSection: FC<HeroSectionProps> = ({ connectHref }) => {
  const [selectedTask, setSelectedTask] = useState<TaskItem>(REPO_TASKS[0]);
  const [promptInput, setPromptInput] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);

  const handleRunPrompt = (e: FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      setSelectedTask((prev) => ({
        ...prev,
        title: promptInput,
        status: "Custom Patch Generated • Ready",
      }));
      setPromptInput("");
    }, 850);
  };

  return (
    <>
      <section
        id="hero"
        className="relative w-full pt-20 pb-8 px-3 sm:px-6 overflow-hidden"
        style={{ background: "var(--background)" }}
      >
        <div className="relative max-w-[1240px] mx-auto rounded-[24px] overflow-hidden shadow-[0_20px_50px_rgba(37,31,25,0.12)] border border-white/60">
          <div className="relative w-full min-h-[720px] flex flex-col justify-between">
            <img
              src={HERO_BG_URL}
              alt=""
              aria-hidden="true"
              className="hero-bg-media w-full h-full object-cover object-center absolute inset-0"
            />
            <div className="hero-wash absolute inset-0 pointer-events-none" />

            <div className="relative z-10 max-w-[760px] mx-auto text-center pt-14 sm:pt-20 px-5 hero-stagger">
              <a
                href="https://github.com/vaibhav29-ed"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-[12px] font-medium mb-5 hover:bg-white/[0.32] hover:border-white/50 transition-colors"
                style={{ color: "#ffffff", textDecoration: "none" }}
              >
                <span className="live-dot" aria-hidden="true" />
                <span>Say Hello to Developer!</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#f48d16] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>

              <h1 className="parley-h1 drop-shadow-[0_2px_16px_rgba(37,31,25,0.28)]">
                The AI agent that works with you, not just for you
              </h1>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <a
                  href={connectHref}
                  className="px-5 py-3 rounded-[10px] bg-[#251f19] text-white text-[14px] font-medium hover:bg-[#382f27] transition-all shadow-[0_10px_24px_rgba(37,31,25,0.25)] cursor-pointer flex items-center gap-2"
                  style={{ color: "#ffffff", textDecoration: "none" }}
                >
                  <span>Connect GitHub</span>
                </a>
                <a
                  href="#architecture"
                  className="px-5 py-3 rounded-[10px] bg-white/90 backdrop-blur-md text-[#251f19] text-[14px] font-medium hover:bg-white transition-all shadow-sm"
                  style={{ color: "#251f19", textDecoration: "none" }}
                >
                  Learn More
                </a>
              </div>
            </div>

            <div
              id="demo-console"
              className="glass-panel relative z-10 w-[94%] max-w-[920px] mx-auto mt-10 mb-6 rounded-[20px] backdrop-blur-2xl border shadow-[var(--shadow-float)] overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[400px]">
                <div className="md:col-span-4 bg-[#f7f7f4]/80 border-b md:border-b-0 md:border-r border-[#e5e2dc] p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-display font-semibold text-[14px] text-[#251f19]">
                        CommitScibble Agent
                      </span>
                      <span className="badge-pill px-2 py-0.5 bg-[#eeede6] text-[#251f19] text-[11px] font-medium flex items-center gap-1">
                        <span
                          className={`w-3 h-3 rounded-full border-2 border-[#f48d16] border-t-transparent ${
                            isSimulating ? "framer-spinner" : ""
                          }`}
                        />
                        {isSimulating ? "Syncing..." : "Worker Idle"}
                      </span>
                    </div>

                    <div className="space-y-1.5 mb-5">
                      <div className="text-[11px] uppercase tracking-wider text-[#68615a] font-medium px-2">
                        Connected Repositories
                      </div>
                      {REPO_TASKS.map((item) => {
                        const active = selectedTask.id === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setSelectedTask(item)}
                            className={`w-full text-left px-3 py-2.5 rounded-[10px] transition-all flex items-start gap-2.5 cursor-pointer ${
                              active
                                ? "bg-white shadow-[0_4px_12px_rgba(37,31,25,0.06)] border border-black/5"
                                : "hover:bg-white/60 text-[#68615a]"
                            }`}
                          >
                            <FolderGit2
                              className={`w-4 h-4 mt-0.5 shrink-0 ${
                                active ? "text-[#f48d16]" : "text-[#68615a]"
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-[12px] text-[#251f19] truncate">
                                {item.repo}
                              </div>
                              <div className="text-[11px] text-[#68615a] truncate">
                                {item.branch}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-3 rounded-[12px] bg-[#eeede6]/90 border border-black/5">
                    <div className="text-[11px] font-medium text-[#251f19] mb-1">
                      Background Worker Pipeline
                    </div>
                    <div className="text-[11px] text-[#68615a] leading-relaxed">
                      Node.js + Express webhooks queued via Redis &amp; persisted in MongoDB.
                    </div>
                  </div>
                </div>

                <div className="md:col-span-8 p-5 sm:p-7 flex flex-col justify-between bg-white/85">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#eeede6]">
                      <div>
                        <span className="text-[11px] font-mono-code text-[#68615a]">
                          {selectedTask.workerNode}
                        </span>
                        <h3 className="text-[18px] font-medium text-[#251f19] mt-0.5">
                          {selectedTask.title}
                        </h3>
                      </div>
                      <span className="badge-pill px-2.5 py-1 bg-[#251f19] text-white text-[11px] font-medium flex items-center gap-1.5">
                        <GitPullRequest className="w-3.5 h-3.5 text-[#f48d16]" />
                        {selectedTask.status}
                      </span>
                    </div>

                    <form onSubmit={handleRunPrompt} className="mt-4">
                      <div className="relative flex items-center rounded-[12px] bg-[#f7f7f4] border border-[#e5e2dc] px-3.5 py-2.5 focus-within:border-[#251f19] transition-colors">
                        <Sparkles className="w-4 h-4 text-[#f48d16] mr-2.5 shrink-0" />
                        <input
                          type="text"
                          value={promptInput}
                          onChange={(e) => setPromptInput(e.target.value)}
                          placeholder="Ask CommitScibble to generate a README patch or analyze a controller..."
                          aria-label="Describe a documentation task"
                          className="w-full bg-transparent text-[12px] text-[#251f19] placeholder-[#68615a] focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="ml-2 px-3 py-1.5 rounded-[8px] bg-[#251f19] text-white text-[11px] font-medium hover:bg-[#382f27] transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <span>Synthesize</span>
                          <Send className="w-3 h-3" />
                        </button>
                      </div>
                    </form>

                    <div className="mt-4 rounded-[12px] border border-[#eeede6] bg-[#fafaf8] overflow-hidden">
                      <div className="px-3.5 py-2 bg-[#eeede6]/70 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileCode2 className="w-3.5 h-3.5 text-[#251f19]" />
                          <span className="font-mono-code text-[11px] font-medium text-[#251f19]">
                            {selectedTask.diffTitle}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#0000ee] font-medium">Auto-Patch Diff</span>
                      </div>
                      <div className="p-3 font-mono-code text-[11px] space-y-1.5 overflow-x-auto">
                        {selectedTask.diffLines.map((line, i) => (
                          <div
                            key={i}
                            className={`px-2 py-0.5 rounded-[4px] ${
                              line.type === "add"
                                ? "bg-emerald-500/10 text-emerald-950"
                                : line.type === "del"
                                  ? "bg-rose-500/10 text-rose-900 line-through"
                                  : "text-[#68615a]"
                            }`}
                          >
                            {line.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#eeede6] flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-[#68615a]">Quick worker actions:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {["Update README.md", "Scan Express Routes", "Sync MongoDB Models"].map(
                        (action) => (
                          <button
                            key={action}
                            type="button"
                            onClick={() => setPromptInput(action)}
                            className="px-2.5 py-1 rounded-[8px] bg-[#eeede6] hover:bg-[#e2e0d6] text-[#251f19] text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            {action}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="architecture"
        className="w-full py-12 px-4 sm:px-6"
        style={{ background: "transparent" }}
      >
        <div className="max-w-[1240px] mx-auto">
          <div className="rounded-[24px] theme-surface p-6 sm:p-10 shadow-[var(--shadow-card)] border">
            <div className="pb-8 border-b theme-border">
              <div className="max-w-[820px]">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#eeede6] text-[#251f19] text-[11px] font-medium mb-3">
                  <Cpu className="w-3.5 h-3.5 text-[#f48d16]" />
                  <span>Full-Stack Repository Intelligence</span>
                </div>
                <h2 className="text-[28px] sm:text-[32px] font-medium text-[#251f19] tracking-tight">
                  Built for developers who want their codebase documented as fast as they ship.
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-8">
              {[
                {
                  icon: GitBranch,
                  color: "#f48d16",
                  title: "GitHub OAuth & Webhooks",
                  desc: "Connects repositories in one click, tracking pushes, PR diffs, and file tree mutations.",
                },
                {
                  icon: RefreshCw,
                  color: "#251f19",
                  title: "Redis Background Workers",
                  desc: "Separate Node.js worker architecture handles heavy repo cloning and AI AST chunking.",
                },
                {
                  icon: Database,
                  color: "#0000ee",
                  title: "Express + MongoDB Store",
                  desc: "Persists repository context graphs, commit histories, and generated patch revisions.",
                },
                {
                  icon: CheckCircle2,
                  color: "#15803d",
                  title: "One-Click Doc Patches",
                  desc: "Opens clean pull requests for README.md, API references, and architecture notes.",
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="interactive-lift p-5 rounded-[16px] theme-soft border flex flex-col justify-between"
                >
                  <div>
                    <div
                      className="w-9 h-9 rounded-[10px] flex items-center justify-center mb-4 text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      <item.icon className="w-4 h-4" />
                    </div>
                    <h3 className="parley-h3 mb-2">{item.title}</h3>
                    <p className="text-[12px] text-[#68615a] leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
