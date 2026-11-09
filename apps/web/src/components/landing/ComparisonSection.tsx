import type { FC } from "react";
import { CheckCircle2, XCircle, Sparkles, Terminal } from "lucide-react";

const COMPARISON_BG_IMG = "/brand/landing/comparison-bg.png";

export const ComparisonSection: FC = () => {
  return (
    <section
      className="relative w-full py-20 px-4 sm:px-6 overflow-hidden"
      style={{ background: "transparent" }}
    >
      <div className="max-w-[1240px] mx-auto">
        {/* Centered Headline */}
        <div className="max-w-[680px] mx-auto text-center mb-12">
          <h2 className="parley-h2">
            From commit to done.
            <br />
            Without the back-and-forth.
          </h2>
          <p className="mt-4 text-[16px] text-[#68615a] leading-relaxed">
            Most AI coding tools wait in a browser tab until you paste files into them. CommitScibble
            lives inside your repository workflow.
          </p>
        </div>

        {/* Comparison Showcase Card with Warm Glassmorphic Backdrop */}
        <div className="relative rounded-[28px] overflow-hidden p-5 sm:p-10 shadow-[var(--shadow-card)] border theme-border">
          <img
            src={COMPARISON_BG_IMG}
            alt=""
            aria-hidden="true"
            className="ambient-image absolute inset-0 w-full h-full object-cover opacity-55 pointer-events-none"
          />
          <div className="ambient-wash absolute inset-0 pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Card: CommitScibble Autonomous Agent (Light Card) */}
            <div className="card p-6 sm:p-8 flex flex-col justify-between bg-white/95">
              <div>
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#eeede6]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[10px] bg-[#f48d16] flex items-center justify-center text-white">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="parley-h3">CommitScibble Agent</h3>
                      <span className="text-[11px] text-[#68615a]">
                        Automated GitHub + Worker Pipeline
                      </span>
                    </div>
                  </div>
                  <span className="badge-pill px-2.5 py-1 bg-[#eeede6] text-[#251f19] font-medium">
                    Zero Manual Prompts
                  </span>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      step: "01",
                      title: "Automatic GitHub webhook ingestion",
                      desc: "Triggers automatically whenever commits land on main or feature branches.",
                    },
                    {
                      step: "02",
                      title: "Isolated Redis background worker analysis",
                      desc: "Clones repo, traverses React, TypeScript & Express ASTs without blocking your laptop.",
                    },
                    {
                      step: "03",
                      title: "MongoDB symbol & route correlation",
                      desc: "Understands how backend Mongoose models, controllers, and frontend hooks connect.",
                    },
                    {
                      step: "04",
                      title: "Ready-to-merge documentation patch PR",
                      desc: "Opens a verified Pull Request updating README.md, API docs, and setup guides.",
                    },
                  ].map((item) => (
                    <div
                      key={item.step}
                      className="p-3.5 rounded-[14px] bg-[#f7f7f4] border border-[#eeede6] flex items-start gap-3"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#f48d16] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[13px] font-medium text-[#251f19]">{item.title}</div>
                        <div className="text-[12px] text-[#68615a] mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#eeede6] flex items-center justify-between text-[12px]">
                <span className="text-[#68615a]">Total developer effort required:</span>
                <span className="font-medium text-[#251f19]">1 click ("Merge Pull Request")</span>
              </div>
            </div>

            {/* Right Card: Standard Chatbots */}
            <div
              className="rounded-[20px] p-6 sm:p-8 flex flex-col justify-between text-white shadow-[0_12px_24px_rgba(37,31,25,0.18)]"
              style={{ backgroundColor: "#251f19" }}
            >
              <div>
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[10px] bg-white/10 flex items-center justify-center text-white/80">
                      <Terminal className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-[20px] font-medium text-white">Generic AI Chatbots</h3>
                      <span className="text-[11px] text-white/60">
                        Manual Context Pasting Workflow
                      </span>
                    </div>
                  </div>
                  <span className="badge-pill px-2.5 py-1 bg-white/10 text-white/90 font-medium">
                    Manual Loop
                  </span>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      title: "Stale README discovered weeks later",
                      desc: "New engineers complain that environment variables and Express routes don't match docs.",
                    },
                    {
                      title: "Repetitive file copying into browser chat",
                      desc: "You manually open 15 files across client/ and server/ and paste code blocks into prompts.",
                    },
                    {
                      title: "Context truncation & hallucinated imports",
                      desc: "Without full repo AST visibility, the chatbot guesses package versions and file paths.",
                    },
                    {
                      title: "Manual Markdown formatting & Git commits",
                      desc: "You still have to copy the response back into VS Code, fix diffs, and push a branch.",
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-[14px] bg-white/5 border border-white/10 flex items-start gap-3"
                    >
                      <XCircle className="w-4 h-4 text-white/45 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[13px] font-medium text-white">{item.title}</div>
                        <div className="text-[12px] text-white/65 mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[12px]">
                <span className="text-white/60">Total developer effort required:</span>
                <span className="font-medium text-[#f48d16]">
                  45–90 mins of manual maintenance per release
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
