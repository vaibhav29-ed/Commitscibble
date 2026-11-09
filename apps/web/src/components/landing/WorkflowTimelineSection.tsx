import type { FC } from "react";
import { useState } from "react";
import { GitCommit, Cpu, FileDiff, Check } from "lucide-react";

const WORKFLOW_WAVE_IMG = "/brand/landing/workflow-wave.png";

interface TimelineStep {
  id: number;
  time: string;
  label: string;
  sublabel: string;
  badgeColor: string;
  patchSummary: string;
  filesTouched: string;
}

const STEPS: TimelineStep[] = [
  {
    id: 0,
    time: "14:00:08",
    label: "GitHub webhook triggered",
    sublabel: "git push origin main • 14 commits detected",
    badgeColor: "#251f19",
    patchSummary: "Express webhook verified payload signature and queued repository snapshot.",
    filesTouched: "src/routes/webhook.ts, src/models/RepoSync.ts",
  },
  {
    id: 1,
    time: "14:00:15",
    label: "Redis worker dispatched",
    sublabel: "worker-node-03 • cloning & parsing TypeScript AST",
    badgeColor: "#f48d16",
    patchSummary: "Background worker parsed 48 source files and extracted exported interfaces.",
    filesTouched: "src/workers/astParser.ts, src/services/redisQueue.ts",
  },
  {
    id: 2,
    time: "14:00:29",
    label: "AI documentation diff generated",
    sublabel: "Updating README.md & API endpoint documentation",
    badgeColor: "#0000ee",
    patchSummary: "Generated markdown tables for 6 new Express routes and MongoDB collections.",
    filesTouched: "README.md (+42 lines), docs/API.md (+28 lines)",
  },
  {
    id: 3,
    time: "14:00:42",
    label: "Documentation patch merged",
    sublabel: "Pull Request #147 ready for review",
    badgeColor: "#15803d",
    patchSummary: "Clean git patch pushed to branch docs/auto-patch-147 with zero conflicts.",
    filesTouched: "PR #147 • CommitScibble Bot",
  },
];

export const WorkflowTimelineSection: FC = () => {
  const [activeStep, setActiveStep] = useState<number>(2);

  return (
    <section
      id="how-it-works"
      className="relative w-full py-20 px-4 sm:px-6 overflow-hidden"
      style={{ background: "transparent" }}
    >
      <div className="max-w-[1240px] mx-auto">
        {/* Centered Headline */}
        <div className="max-w-[680px] mx-auto text-center mb-12">
          <h2 className="parley-h2">
            Tell CommitScibble once.
            <br />
            It handles the rest.
          </h2>
          <p className="mt-4 text-[16px] text-[#68615a] leading-relaxed">
            CommitScibble isn't just a chat window — it's an autonomous documentation pipeline that
            watches commits, dispatches Redis workers, and opens verified README patches.
          </p>
        </div>

        {/* Interactive Timeline Card with Background Wave Imagery */}
        <div className="relative rounded-[28px] overflow-hidden shadow-[var(--shadow-card)] border theme-border bg-[#f7f7f4]">
          <div className="relative min-h-[340px] flex flex-col justify-between p-6 sm:p-10">
            <img
              src={WORKFLOW_WAVE_IMG}
              alt=""
              aria-hidden="true"
              className="ambient-image absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
            />
            <div className="ambient-wash absolute inset-0 pointer-events-none" />

            {/* Top Interactive Step Selector */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 mb-8">
              <span className="badge-pill px-3 py-1 bg-white/90 backdrop-blur-md text-[#251f19] font-medium shadow-xs">
                Interactive Pipeline Simulator • Click any stage
              </span>
              <div className="flex items-center gap-1.5">
                {STEPS.map((step) => (
                  <button
                    key={step.id}
                    onClick={() => setActiveStep(step.id)}
                    aria-pressed={activeStep === step.id}
                    className={`px-3 py-1 rounded-[8px] text-[11px] font-medium transition-all cursor-pointer ${
                      activeStep === step.id
                        ? "bg-[#251f19] text-white shadow-xs"
                        : "bg-white/75 text-[#251f19] hover:bg-white"
                    }`}
                  >
                    Stage 0{step.id + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* 4-Stage Visual Horizontal Track */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-auto">
              {STEPS.map((step, index) => {
                const isSelected = activeStep === index;
                const isCompleted = index <= activeStep;
                return (
                  <div
                    key={step.id}
                    onClick={() => setActiveStep(index)}
                    className={`cursor-pointer rounded-[18px] p-4 transition-all duration-300 border ${
                      isSelected
                        ? "bg-white shadow-[0_14px_28px_rgba(37,31,25,0.14)] border-[#251f19] -translate-y-1"
                        : isCompleted
                          ? "bg-white/85 border-white shadow-[0_8px_16px_rgba(37,31,25,0.06)]"
                          : "bg-white/60 border-white/50 opacity-80 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-medium"
                        style={{ backgroundColor: step.badgeColor }}
                      >
                        {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
                      </span>
                      <span className="font-mono-code text-[11px] text-[#68615a]">{step.time}</span>
                    </div>
                    <div className="text-[14px] font-medium text-[#251f19] mb-1">{step.label}</div>
                    <div className="text-[11px] text-[#68615a] leading-snug">{step.sublabel}</div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Live Stage Telemetry Output */}
            <div
              key={activeStep}
              className="content-swap relative z-10 mt-8 pt-4 border-t theme-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 glass-panel-strong backdrop-blur-md px-4 py-3 rounded-[14px]"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f48d16]" />
                <span className="text-[12px] font-medium text-[#251f19]">
                  {STEPS[activeStep].patchSummary}
                </span>
              </div>
              <span className="font-mono-code text-[11px] text-[#0000ee]">
                {STEPS[activeStep].filesTouched}
              </span>
            </div>
          </div>

          {/* 3-Column Bottom Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 sm:p-10 bg-white border-t border-[#eeede6]">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <GitCommit className="w-4 h-4 text-[#f48d16]" />
                <h3 className="parley-h3">Repo structure</h3>
              </div>
              <p className="text-[14px] text-[#68615a] leading-relaxed">
                You push new modules, API routes, or database schemas. CommitScibble indexes
                directories and dependencies immediately.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-4 h-4 text-[#251f19]" />
                <h3 className="parley-h3">Background workers</h3>
              </div>
              <p className="text-[14px] text-[#68615a] leading-relaxed">
                Dedicated Node.js and Redis workers process AST trees and summarize code changes
                without slowing down your CI/CD runners.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileDiff className="w-4 h-4 text-[#0000ee]" />
                <h3 className="parley-h3">Patch delivery</h3>
              </div>
              <p className="text-[14px] text-[#68615a] leading-relaxed">
                Review and merge clean Pull Request diffs for README.md, architecture overviews, and
                onboarding guides in one click.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
