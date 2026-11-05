import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BookOpen,
  ChevronRight,
  Github,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { ApiError } from "../lib/api";
import { useLogout, useMe } from "../lib/query";
import { useTheme } from "../lib/theme";
import { cn } from "../lib/cn";
import { Button, Skeleton } from "./ui";

export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5" aria-label="CommitScibble home">
      <img
        src="/brand/logo.png"
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 rounded-[10px] object-cover shadow-subtle ring-1 ring-black/5 transition-transform duration-150 ease-smooth group-hover:-translate-y-0.5 dark:ring-white/10"
      />
      {withWordmark ? (
        <span className="font-display text-[15px] font-medium tracking-tight">
          Commit<span className="text-muted-foreground">Scibble</span>
        </span>
      ) : null}
    </Link>
  );
}

const NAV_ITEMS = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/dashboard/repositories", label: "Repositories", icon: Github, end: false },
  { to: "/dashboard/activity", label: "Activity", icon: Activity, end: false },
  { to: "/dashboard/settings", label: "Settings", icon: Settings, end: false },
  { to: "/docs", label: "Documentation", icon: BookOpen, end: false },
];

export function ProtectedRoute() {
  const me = useMe();
  if (me.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
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
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useLogout();
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const user = me.data?.user;

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card/95 backdrop-blur transition-transform duration-150 ease-smooth lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Logo />
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                  isActive
                    ? "bg-brand-50 font-medium text-primary dark:bg-brand-500/10 dark:text-brand-300"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-lg p-2">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-8 w-8 rounded-full border border-border"
                loading="lazy"
              />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-xs text-primary dark:bg-brand-500/10 dark:text-brand-300">
                {user?.githubLogin?.slice(0, 2).toUpperCase() ?? "CS"}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.displayName ?? user?.githubLogin}</p>
              <p className="truncate text-xs text-muted-foreground">@{user?.githubLogin}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 w-full justify-start"
            onClick={() => {
              logout.mutate(undefined, {
                onSettled: () => navigate("/signin"),
              });
            }}
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </aside>

      {mobileOpen ? (
        <div
          className="motion-fade-in fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Breadcrumbs pathname={location.pathname} />
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer noopener"
              className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
            >
              <Github className="h-3.5 w-3.5" /> GitHub
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      {segments.map((segment, index) => (
        <span key={`${segment}-${index}`} className="flex items-center gap-1">
          {index > 0 ? <ChevronRight className="h-3 w-3" /> : null}
          <span className={index === segments.length - 1 ? "font-medium text-foreground" : ""}>
            {formatSegment(segment)}
          </span>
        </span>
      ))}
    </div>
  );
}

function formatSegment(segment: string): string {
  if (/^[a-f0-9]{24}$/i.test(segment)) return "Detail";
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
