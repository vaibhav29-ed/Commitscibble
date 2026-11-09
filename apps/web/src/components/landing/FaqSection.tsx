import type { FC } from "react";
import { useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "How is CommitScibble different from ChatGPT or in-editor autocomplete?",
    answer:
      "Autocomplete helps you write individual lines of code, and chatbots require you to manually copy-paste files into a prompt. CommitScibble connects directly to your GitHub repositories, analyzes your entire project structure in isolated background workers, and opens ready-to-merge Pull Request patches for README.md and API docs whenever your code changes.",
  },
  {
    question: "How does CommitScibble's background worker architecture work?",
    answer:
      "When you connect a repository or push a commit, our Node.js & Express API ingests the GitHub webhook and dispatches a job into a Redis queue. A separate background worker clones the snapshot, parses the React/TypeScript/Express AST, stores symbol graphs in MongoDB, and synthesizes clean documentation diffs without impacting your CI/CD pipeline.",
  },
  {
    question: "Do I have to maintain complex CI configuration files?",
    answer:
      "No. Simply authenticate via GitHub OAuth, select the repositories you want CommitScibble to manage, and click 'Generate Initial Patch'. From then on, CommitScibble automatically detects structural code changes, new API routes, or updated environment variables.",
  },
  {
    question: "Is my source code stored or used to train public models?",
    answer:
      "Never. Background worker sandboxes process your repository in ephemeral memory and strictly store AST structural metadata and documentation patch diffs in your encrypted MongoDB tenant workspace. We never train third-party models on your private codebases.",
  },
  {
    question: "Which documentation files can CommitScibble generate and patch?",
    answer:
      "CommitScibble automatically creates and maintains root README.md files, REST API endpoint references (Express/Fastify routes), MongoDB/PostgreSQL schema documentation, ARCHITECTURE.md overviews, and release changelogs.",
  },
  {
    question: "How does the Pull Request workflow prevent unwanted documentation overwrites?",
    answer:
      "CommitScibble never pushes directly to your protected main branch. Instead, it creates a clean documentation patch PR with line-by-line diffs. You can inspect, edit in our web sandbox, or merge in a single click.",
  },
];

export const FaqSection: FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="relative w-full py-20 px-4 sm:px-6">
      <div className="max-w-[1240px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-4 lg:sticky lg:top-28">
            <h2 className="parley-h2">
              Questions
              <br />
              answered.
            </h2>
            <p className="mt-4 text-[14px] text-[#68615a] leading-relaxed max-w-[320px]">
              Everything you need to know about connecting GitHub repositories, background worker
              indexing, and automated documentation patches.
            </p>
            <a
              href="#docs"
              className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium group"
            >
              Read the quickstart docs
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>

          <div className="lg:col-span-8 space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openIndex === idx;
              const answerId = `faq-answer-${idx}`;
              return (
                <article
                  key={item.question}
                  className={`rounded-[20px] theme-surface border overflow-hidden transition-all duration-300 ${
                    isOpen
                      ? "shadow-[0_16px_32px_rgba(37,31,25,0.1)] border-[#f48d16]/45"
                      : "shadow-[0_12px_16px_0px_#EBE8E4] hover:border-[#251f19]/20"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                    className="w-full px-5 sm:px-6 py-5 text-left flex items-center justify-between gap-4 cursor-pointer group"
                  >
                    <span className="text-[15px] sm:text-[16px] font-medium text-[#251f19] leading-snug">
                      {item.question}
                    </span>
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                        isOpen
                          ? "bg-[#f48d16] text-white rotate-45"
                          : "bg-[#f7f7f4] text-[#251f19] group-hover:rotate-90"
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  </button>

                  <div id={answerId} className="faq-answer" data-open={isOpen} aria-hidden={!isOpen}>
                    <div>
                      <p className="mx-5 sm:mx-6 mb-6 pt-4 text-[14px] text-[#68615a] leading-[1.65] border-t theme-border">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
