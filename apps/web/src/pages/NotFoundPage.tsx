import { Link } from "react-router-dom";
import { Button } from "../components/ui";
import { Logo } from "../components/shell";

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-hero-fade" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-40 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,black,transparent_75%)]"
      />
      <header className="relative z-10 border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-6">
          <Logo />
        </div>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="font-mono text-xs text-muted-foreground">404</p>
        <h1 className="mt-2 font-display text-3xl font-normal">Page not found</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
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
