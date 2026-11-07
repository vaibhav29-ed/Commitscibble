import { Link } from "react-router-dom";
import { Button } from "../components/ui";
import { Logo } from "../components/shell";

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <header className="relative z-10 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-content items-center px-6 sm:px-8">
          <Logo />
        </div>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="rounded-full border border-border bg-card px-3 py-1 font-mono text-xs text-muted-foreground">
          404
        </span>
        <h1 className="type-title-lg mt-4">Page not found</h1>
        <p className="mt-3 text-[17px] leading-[1.75] text-muted-foreground">
          The page you requested does not exist. It may have been removed, or the link is incorrect.
        </p>
        <div className="mt-6 flex gap-2">
          <Link to="/">
            <Button variant="outline">Home</Button>
          </Link>
          <Link to="/dashboard">
            <Button>Dashboard</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
