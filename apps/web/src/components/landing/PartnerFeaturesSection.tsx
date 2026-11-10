import type { FC } from "react";
import { Compass, Layers, Cpu } from "lucide-react";

const PARTNER_BG_IMG = "/brand/landing/partner-bg.png";

export const PartnerFeaturesSection: FC = () => {
  return (
    <section
      id="features"
      className="relative w-full py-20 px-4 sm:px-6 overflow-hidden"
      style={{ background: "transparent" }}
    >
      <div className="max-w-[1240px] mx-auto relative">
        <div className="max-w-[700px] mx-auto text-center mb-14">
          <h2 className="parley-h2">
            A real partner,
            <br />
            not a chatbot in disguise
          </h2>
          <p className="mt-4 text-[16px] text-[#68615a] leading-relaxed">
            Built for engineers who need their repository structure understood automatically —
            generating documentation patches instead of generic chat answers.
          </p>
        </div>

        <div className="relative rounded-[28px] p-4 sm:p-8 overflow-hidden">
          <img
            src={PARTNER_BG_IMG}
            alt=""
            aria-hidden="true"
            className="ambient-image absolute inset-0 w-full h-full object-cover opacity-55 pointer-events-none"
          />
          <div className="ambient-wash absolute inset-0 pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 bento-grid">
            <div className="card bento-card flex flex-col justify-between p-6 sm:p-8 min-h-[260px] transition-transform duration-300 hover:-translate-y-1">
              <div>
                <div className="w-11 h-11 rounded-[12px] bg-[#f48d16] flex items-center justify-center text-white mb-6 shadow-[0_6px_14px_rgba(244,141,22,0.28)]">
                  <Compass className="w-5 h-5" />
                </div>
                <h3 className="parley-h3 mb-3">Context, carried across every commit</h3>
              </div>
              <p className="text-[14px] text-[#68615a] leading-[1.55]">
                CommitScibble maps your React frontend, Express routes, and MongoDB models across
                branches so your documentation stays accurate as code evolves.
              </p>
            </div>

            <div className="card bento-card flex flex-col justify-between p-6 sm:p-8 min-h-[260px] transition-transform duration-300 hover:-translate-y-1">
              <div>
                <div className="w-11 h-11 rounded-[12px] bg-[#251f19] flex items-center justify-center text-[#f48d16] mb-6 shadow-[0_6px_14px_rgba(37,31,25,0.2)]">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="parley-h3 mb-3">One pipeline, multiple repositories</h3>
              </div>
              <p className="text-[14px] text-[#68615a] leading-[1.55]">
                No more context-switching between code editors and stale markdown wikis. Analyze
                monorepos or microservices and patch README files in one place.
              </p>
            </div>

            <div className="card bento-card flex flex-col justify-between p-6 sm:p-8 min-h-[260px] transition-transform duration-300 hover:-translate-y-1">
              <div>
                <div className="w-11 h-11 rounded-[12px] bg-[#0000ee] flex items-center justify-center text-white mb-6 shadow-[0_6px_14px_rgba(0,0,238,0.25)]">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="parley-h3 mb-3">Background workers with purpose</h3>
              </div>
              <p className="text-[14px] text-[#68615a] leading-[1.55]">
                Powered by a decoupled Redis and Node.js worker architecture that parses source
                trees and prepares ready-to-merge documentation pull requests.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
