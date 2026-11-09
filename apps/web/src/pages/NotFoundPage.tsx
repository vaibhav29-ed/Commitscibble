import { Link } from "react-router-dom";
import { Button, Panel } from "../components/ui";
import { Logo } from "../components/shell";

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--background)] text-[var(--text-primary)]">
      <header className="px-3 pt-3 sm:px-6">
        <div className="glass-nav mx-auto flex max-w-[1200px] items-center rounded-[14px] border px-4 py-2.5">
          <Logo />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <Panel className="w-full">
          <span className="inline-flex rounded-full border border-[var(--border-soft)] px-3 py-1 font-mono text-[11px] text-[var(--text-secondary)]">
            404
          </span>
          <h1 className="dash-title mt-4 text-[32px]">Page not found</h1>
          <p className="mt-3 text-[14px] leading-[1.7] text-[var(--text-secondary)]">
            The page you requested does not exist. It may have been removed, or the link is
            incorrect.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link to="/">
              <Button variant="outline">Home</Button>
            </Link>
            <Link to="/dashboard">
              <Button>Dashboard</Button>
            </Link>
          </div>
        </Panel>
      </main>
    </div>
  );
}
