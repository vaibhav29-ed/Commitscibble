import type { FC, FormEvent } from "react";
import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";

interface IntegrationsFooterSectionProps {
  connectHref: string;
}

export const IntegrationsFooterSection: FC<IntegrationsFooterSectionProps> = ({ connectHref }) => {
  const [email, setEmail] = useState<string>("");
  const [subscribed, setSubscribed] = useState<boolean>(false);

  const handleSubscribe = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setEmail("");
  };

  return (
    <footer className="w-full pt-8 pb-10 px-3 sm:px-6">
      <div
        className="max-w-[1240px] mx-auto rounded-[28px] p-8 sm:p-14 text-white shadow-[0_20px_50px_rgba(37,31,25,0.22)]"
        style={{ backgroundColor: "#251f19" }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-[8px] bg-white/10 flex items-center justify-center p-1">
                <img src="/brand/logo.png" alt="" className="w-5 h-5 object-contain" />
              </div>
              <span className="font-display font-semibold text-[18px] tracking-tight text-white">
                CommitScibble
              </span>
            </div>

            <h3 className="text-[28px] sm:text-[32px] font-medium text-white tracking-tight mb-3">
              Stay on the cutting edge of AI documentation
            </h3>
            <p className="text-[13px] text-white/65 leading-relaxed mb-6 max-w-[380px]">
              Intelligent repository management assistant built with React, TypeScript, Express,
              MongoDB, and Redis background workers.
            </p>

            <form onSubmit={handleSubscribe} className="max-w-[360px]">
              {subscribed ? (
                <div className="p-3 rounded-[10px] bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-[12px] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Subscribed to CommitScibble release notes!</span>
                </div>
              ) : (
                <div className="flex items-center rounded-[10px] bg-white/10 border border-white/15 p-1">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="developer@company.com"
                    aria-label="Email address for release notes"
                    className="w-full bg-transparent px-3 py-1.5 text-[12px] text-white placeholder-white/50 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-[8px] bg-[#f48d16] text-white text-[12px] font-medium hover:bg-[#e07d0c] transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <span>Join</span>
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              )}
            </form>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 gap-8">
            <div>
              <div className="text-[12px] font-medium text-white mb-4">Platform</div>
              <ul className="space-y-2.5 text-[12px] text-white/65">
                {[
                  { label: "Features", href: "#features" },
                  { label: "How it works", href: "#how-it-works" },
                  { label: "FAQ", href: "#faq" },
                  { label: "Docs", href: "#docs" },
                ].map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="hover:text-white transition-colors"
                      style={{ color: "rgba(255,255,255,0.68)", textDecoration: "none" }}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-[12px] font-medium text-white mb-4">Developers</div>
              <ul className="space-y-2.5 text-[12px] text-white/65">
                <li>
                  <a
                    href={connectHref}
                    className="hover:text-white transition-colors"
                    style={{ color: "rgba(255,255,255,0.68)", textDecoration: "none" }}
                  >
                    Connect GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="#faq"
                    className="hover:text-white transition-colors"
                    style={{ color: "rgba(255,255,255,0.68)", textDecoration: "none" }}
                  >
                    Security &amp; Privacy
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="pt-8 flex items-center justify-between gap-4 text-[12px] text-white/50">
          <div>© {new Date().getFullYear()} CommitScibble AI. All rights reserved.</div>
        </div>
      </div>
    </footer>
  );
};
