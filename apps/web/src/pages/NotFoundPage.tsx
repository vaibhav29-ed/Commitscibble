import { Link } from "react-router-dom";
import { Button } from "../components/ui";
import { Logo } from "../components/shell";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center">
        <p className="font-mono text-xs text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
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
