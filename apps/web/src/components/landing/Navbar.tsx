import { useEffect, useState } from "react";
import type { FC } from "react";
import { Sun, Moon, Monitor, ArrowUpRight, Menu, X } from "lucide-react";

export type ThemeMode = "light" | "dark" | "system";

const NAV_ITEMS = [
  { label: "Features", href: "#features", id: "features" },
  { label: "How it works", href: "#how-it-works", id: "how-it-works" },
  { label: "FAQ", href: "#faq", id: "faq" },
  { label: "Docs", href: "#docs", id: "docs" },
];

interface NavbarProps {
  connectHref: string;
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

const GitHubIcon: FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

export const Navbar: FC<NavbarProps> = ({ connectHref, theme, onThemeChange }) => {
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24);
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-25% 0px -58% 0px", threshold: [0, 0.1, 0.4] },
    );
    NAV_ITEMS.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  const themeOptions: {
    mode: ThemeMode;
    label: string;
    icon: FC<{ className?: string }>;
  }[] = [
    { mode: "light", label: "Light", icon: Sun },
    { mode: "dark", label: "Dark", icon: Moon },
    { mode: "system", label: "System", icon: Monitor },
  ];

  return (
    <header
      className={`glass-nav fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-[1200px] rounded-[14px] border transition-all duration-500 ${
        scrolled ? "shadow-[0_10px_32px_rgba(37,31,25,0.12)]" : "shadow-none"
      }`}
    >
      <div className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
        <a
          href="#hero"
          className="flex items-center gap-2.5 shrink-0 focus:outline-none"
          style={{ textDecoration: "none" }}
          aria-label="CommitScibble home"
        >
          <div className="relative w-7 h-7 rounded-[8px] bg-[#251f19] flex items-center justify-center overflow-hidden shadow-xs">
            <img src="/brand/logo.png" alt="" className="w-5 h-5 object-contain" />
          </div>
          <span className="hidden min-[420px]:inline font-display font-semibold text-[15px] tracking-tight text-[#251f19]">
            CommitScibble
          </span>
        </a>

        <nav className="hidden lg:flex items-center gap-7" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              aria-current={activeSection === item.id ? "true" : undefined}
              className="nav-link text-[12px] font-medium text-[#251f19] hover:text-[#0000ee]"
              style={{ textDecoration: "none" }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Color theme"
            className="inline-flex items-center p-0.5 rounded-[10px] bg-[#eeede6] border border-black/5"
          >
            {themeOptions.map(({ mode, label, icon: Icon }) => {
              const active = theme === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onThemeChange(mode)}
                  title={`${label} theme`}
                  aria-label={`${label} theme`}
                  aria-pressed={active}
                  className={`theme-option inline-flex items-center gap-1 px-2 py-1 rounded-[8px] text-[11px] font-medium cursor-pointer ${
                    active ? "bg-[#251f19] text-white shadow-xs" : "text-[#68615a] hover:text-[#251f19]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">{label}</span>
                </button>
              );
            })}
          </div>

          <a
            href={connectHref}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-[8px] bg-[#251f19] text-white text-[12px] font-medium hover:bg-[#3a3128] transition-all cursor-pointer shadow-xs"
            style={{ color: "#ffffff", textDecoration: "none" }}
          >
            <GitHubIcon className="w-3.5 h-3.5 text-[#f48d16]" />
            <span className="hidden sm:inline">Connect GitHub</span>
            <ArrowUpRight className="hidden sm:inline w-3.5 h-3.5 text-white/75" />
          </a>

          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="lg:hidden w-8 h-8 rounded-[8px] theme-soft border flex items-center justify-center text-[#251f19] cursor-pointer"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div
        className={`lg:hidden grid transition-[grid-template-rows,opacity] duration-300 ${
          mobileOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <nav className="overflow-hidden" aria-label="Mobile navigation">
          <div className="mx-3 mb-3 pt-2 border-t theme-border grid grid-cols-2 gap-2">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-[9px] theme-soft text-[13px] font-medium text-[#251f19]"
                style={{ textDecoration: "none" }}
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      </div>

      <div className="absolute left-3 right-3 bottom-0 h-px overflow-hidden rounded-full">
        <div
          className="h-full bg-[#f48d16] transition-[width] duration-150 ease-out"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>
    </header>
  );
};
