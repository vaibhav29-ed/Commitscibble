import { useEffect } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Bell,
  FileText,
  FolderGit2,
  GitPullRequest,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { ApiError } from "../lib/api";
import { useActivity, useLogout, useMe, useRepositories } from "../lib/query";
import { useTheme } from "../lib/theme";
import { useRootScale } from "../lib/use-root-scale";
import { cn } from "../lib/cn";

export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="CommitScibble home">
      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[8px] bg-[#251f19] shadow-xs transition-transform duration-300 group-hover:rotate-[-4deg]">
        <img src="/brand/logo.png" alt="" className="h-5 w-5 object-contain" />
      </span>
      {withWordmark ? (
        <span className="font-display text-[15px] font-semibold tracking-tight text-[#251f19] dark:text-[#f5f2ec]">
          CommitScibble
        </span>
      ) : null}
    </Link>
  );
}

const NAV = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/dashboard/repositories", label: "Repositories", icon: FolderGit2, end: false },
  { to: "/dashboard/docs", label: "Documentation", icon: FileText, end: false },
  { to: "/dashboard/patches", label: "Patches", icon: GitPullRequest, end: false },
  { to: "/dashboard/jobs", label: "Background jobs", icon: ListTodo, end: false },
  { to: "/dashboard/activity", label: "Activity", icon: Activity, end: false },
  { to: "/dashboard/settings", label: "Settings", icon: Settings, end: false },
] as const;

function pageTitle(pathname: string): string {
  if (pathname === "/dashboard") return "Overview";
  if (pathname.startsWith("/dashboard/repositories/")) return "Repository";
  if (pathname.startsWith("/dashboard/repositories")) return "Repositories";
  if (pathname.startsWith("/dashboard/reviews/")) return "Review";
  if (pathname.startsWith("/dashboard/docs")) return "Documentation";
  if (pathname.startsWith("/dashboard/patches")) return "Patches";
  if (pathname.startsWith("/dashboard/jobs")) return "Background jobs";
  if (pathname.startsWith("/dashboard/activity/")) return "Activity event";
  if (pathname.startsWith("/dashboard/activity")) return "Activity";
  if (pathname.startsWith("/dashboard/settings")) return "Settings";
  if (pathname.startsWith("/docs")) return "Documentation";
  return "Workspace";
}

function isNavActive(pathname: string, to: string, end: boolean): boolean {
  if (to === "/dashboard/repositories") {
    return (
      pathname.startsWith("/dashboard/repositories") ||
      pathname.startsWith("/dashboard/reviews")
    );
  }
  if (to === "/dashboard/activity") return pathname.startsWith("/dashboard/activity");
  return end ? pathname === to : pathname.startsWith(to);
}

export function ProtectedRoute() {
  const me = useMe();
  useRootScale("cs-dash-root");

  if (me.isPending) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--background)]">
        <div className="content-swap flex flex-col items-center gap-4">
          <Logo withWordmark={false} />
          <div className="inline-flex items-center gap-2 text-[12px] text-[#68615a] dark:text-[#b7aea4]">
            <span className="live-dot" />
            Restoring your workspace…
          </div>
        </div>
      </div>
    );
  }
  if (me.isError) {
    const error = me.error;
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return <Navigate to="/signin" replace />;
    }
  }
  return <AppShell />;
}

export function AppShell() {
  const me = useMe();
  const repositories = useRepositories();
  const activity = useActivity({ pageSize: 50 });
  const logout = useLogout();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  const user = me.data?.user;
  const connected = repositories.data?.connected ?? [];
  const pendingReviews = connected.filter((repo) => repo.pendingProposalId);
  const running = connected.filter((repo) =>
    repo.lastRun ? ["QUEUED", "RUNNING", "RETRYING"].includes(repo.lastRun.status) : false,
  );
  const failedRecent = (activity.data?.items ?? []).filter(
    (event) =>
      event.type === "FAILED" &&
      Date.now() - new Date(event.createdAt).getTime() < 24 * 60 * 60 * 1000,
  ).length;
  const navBadge = (to: string): number => {
    if (to === "/dashboard/repositories") return pendingReviews.length;
    if (to === "/dashboard/patches") return pendingReviews.length;
    if (to === "/dashboard/jobs") return running.length;
    if (to === "/dashboard/activity") return failedRecent;
    return 0;
  };

  const title = pageTitle(location.pathname);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-[8px] focus:bg-[var(--panel-solid)] focus:px-3 focus:py-2 focus:text-[12px]"
      >
        Skip to content
      </a>

      {/* Floating glass sidebar */}
      <aside className="glass-panel fixed bottom-4 left-4 top-4 z-30 hidden w-[240px] flex-col rounded-[20px] border p-4 shadow-[var(--shadow-card)] lg:flex">
        <Link to="/" className="group flex items-center gap-2.5 text-left">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[8px] bg-[#251f19] transition-transform duration-300 group-hover:rotate-[-4deg]">
            <img src="/brand/logo.png" alt="" className="h-5 w-5 object-contain" />
          </span>
          <span>
            <span className="block font-display text-[15px] font-semibold tracking-tight text-[#251f19] dark:text-[#f5f2ec]">
              CommitScibble
            </span>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-[#68615a] dark:text-[#b7aea4]">
              Workspace
            </span>
          </span>
        </Link>

        <nav className="mt-7 space-y-1" aria-label="Dashboard">
          {NAV.map((item) => {
            const active = isNavActive(location.pathname, item.to, item.end);
            const Icon = item.icon;
            const badge = navBadge(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[11px] px-3 py-2.5 text-[12px] font-medium transition-all duration-200",
                  active
                    ? "bg-[#251f19] text-white shadow-[0_8px_18px_rgba(37,31,25,0.18)] dark:bg-[#f5f2ec] dark:text-[#251f19]"
                    : "text-[#251f19] hover:translate-x-0.5 hover:bg-[#eeede6] dark:text-[#f5f2ec] dark:hover:bg-[#2a251f]",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    active
                      ? "text-[#f48d16]"
                      : "text-[#68615a] dark:text-[#b7aea4]",
                  )}
                />
                {item.label}
                {badge > 0 ? (
                  <span className="ml-auto rounded-full bg-[#f48d16] px-1.5 py-0.5 text-[10px] text-white">
                    {badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <Link
            to={
              running.length > 0
                ? `/dashboard/repositories/${running[0].id}`
                : "/dashboard/jobs"
            }
            className="theme-soft block w-full rounded-[14px] border p-3 text-left transition-colors hover:border-[var(--border-strong)]"
          >
            <span className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-primary)]">
              {running.length > 0 ? (
                <span className="live-dot" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-[#948b81]" />
              )}
              {running.length > 0
                ? `${running.length} run${running.length === 1 ? "" : "s"} active`
                : "Queue idle"}
            </span>
            <span className="mt-1 block truncate text-[11px] text-[var(--text-secondary)]">
              {running[0]
                ? `${running[0].fullName} · ${running[0].lastRun ? running[0].lastRun.operation.toLowerCase().replaceAll("_", " ") : "run"}`
                : "Start an analysis to queue work."}
            </span>
          </Link>

          <div className="flex items-center gap-2.5 border-t border-[var(--border-soft)] pt-3">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-9 w-9 rounded-full border border-[var(--border-soft)]"
                loading="lazy"
              />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eeede6] text-[11px] font-semibold text-[#251f19] dark:bg-[#2a251f] dark:text-[#f5f2ec]">
                {user?.githubLogin?.slice(0, 2).toUpperCase() ?? "CS"}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-[var(--text-primary)]">
                @{user?.githubLogin ?? "github"}
              </p>
              <p className="truncate text-[11px] text-[var(--text-secondary)]">
                {user?.displayName ?? "GitHub session"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                logout.mutate(undefined, { onSettled: () => navigate("/signin") });
              }}
              title="Log out"
              aria-label="Log out"
              className="flex h-8 w-8 items-center justify-center rounded-[9px] text-[#68615a] transition-colors hover:bg-[#eeede6] hover:text-[#251f19] dark:text-[#b7aea4] dark:hover:bg-[#2a251f] dark:hover:text-[#f5f2ec]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[272px]">
        {/* Glass top bar */}
        <div className="sticky top-0 z-20 px-3 pt-4 sm:px-6">
          <header className="glass-nav flex items-center justify-between gap-3 rounded-[14px] border px-3 py-2.5 shadow-[0_10px_32px_rgba(37,31,25,0.08)] sm:px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="lg:hidden">
                <Logo withWordmark={false} />
              </span>
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#68615a] dark:text-[#b7aea4]">
                  Workspace
                </div>
                <div className="truncate font-display text-[14px] font-medium text-[#251f19] dark:text-[#f5f2ec]">
                  {title}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/dashboard/activity"
                aria-label="Activity and notifications"
                className="relative flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#eeede6] text-[#251f19] transition-colors hover:bg-[#e3e1d7] dark:bg-[#2a251f] dark:text-[#f5f2ec]"
              >
                <Bell className="h-4 w-4" />
                {failedRecent > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] text-white">
                    {failedRecent}
                  </span>
                ) : null}
              </Link>

              <div
                role="group"
                aria-label="Color theme"
                className="inline-flex items-center rounded-[10px] border border-black/5 bg-[#eeede6] p-0.5 dark:border-white/10 dark:bg-[#2a251f]"
              >
                {[
                  { mode: "light" as const, label: "Light", icon: Sun },
                  { mode: "dark" as const, label: "Dark", icon: Moon },
                  { mode: "system" as const, label: "System", icon: Monitor },
                ].map(({ mode, label, icon: Icon }) => {
                  const active = theme === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={active}
                      aria-label={`${label} theme`}
                      title={`${label} theme`}
                      onClick={() => setTheme(mode)}
                      className={cn(
                        "theme-option inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-[11px] font-medium",
                        active
                          ? "bg-[#251f19] text-white shadow-xs dark:bg-[#f5f2ec] dark:text-[#251f19]"
                          : "text-[#68615a] hover:text-[#251f19] dark:text-[#b7aea4] dark:hover:text-[#f5f2ec]",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden xl:inline">{label}</span>
                    </button>
                  );
                })}
              </div>

              <Link
                to="/"
                className="hidden items-center gap-1 rounded-[9px] px-2.5 py-1.5 text-[11px] font-medium text-[#251f19] transition-colors hover:bg-[#eeede6] dark:text-[#f5f2ec] dark:hover:bg-[#2a251f] sm:inline-flex"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Site
              </Link>
            </div>
          </header>

          {/* Mobile navigation */}
          <nav
            className="dash-scroll mt-2 flex gap-1.5 overflow-x-auto pb-1 lg:hidden"
            aria-label="Dashboard mobile"
          >
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(location.pathname, item.to, item.end);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3 py-2 text-[12px] font-medium",
                    active
                      ? "border-transparent bg-[#251f19] text-white dark:bg-[#f5f2ec] dark:text-[#251f19]"
                      : "glass-panel text-[#251f19] dark:text-[#f5f2ec]",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-3.5 w-3.5",
                      active && "text-[#f48d16]",
                    )}
                  />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <main id="main" className="max-w-[1240px] px-3 pb-16 pt-6 sm:px-6">
          <div key={location.pathname} className="content-swap">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
