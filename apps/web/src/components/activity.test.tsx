// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ActivityRecord } from "../lib/api";
import { ActivityTimeline, DiffViewer } from "./activity";
import { StatusPill } from "./ui";

describe("DiffViewer", () => {
  it("renders added and removed lines with distinct styling", () => {
    const diff = [
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -1,2 +1,2 @@",
      " # Widget",
      "-pnpm install",
      "+pnpm install --frozen-lockfile",
    ].join("\n");

    render(<DiffViewer diff={diff} />);
    expect(screen.getByText("-pnpm install")).toHaveClass("diff-del");
    expect(screen.getByText("+pnpm install --frozen-lockfile")).toHaveClass("diff-add");
    expect(screen.getByText("@@ -1,2 +1,2 @@")).toHaveClass("bg-[var(--surface-3)]");
  });

  it("explains that no changes were proposed", () => {
    render(<DiffViewer diff="" />);
    expect(screen.getByText(/identical to the current README/i)).toBeInTheDocument();
  });
});

describe("ActivityTimeline", () => {
  const event: ActivityRecord = {
    id: "log-1",
    eventId: "evt-1",
    logId: "log-1",
    jobId: "job-1",
    runId: "run-1",
    userId: "user-1",
    repositoryId: "repo-1",
    repositoryFullName: "acme/widget",
    type: "PROGRESS",
    message: "Scanning source files",
    progress: { step: 2, total: 5 },
    createdAt: new Date().toISOString(),
    metadata: null,
  };

  it("renders persisted events with progress and correlation ids", () => {
    render(
      <MemoryRouter>
        <ActivityTimeline events={[event]} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Scanning source files")).toBeInTheDocument();
    expect(screen.getByText("Step 2/5")).toBeInTheDocument();
    expect(screen.getByText("acme/widget")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "log-1" })).toHaveAttribute(
      "href",
      "/dashboard/activity/log-1",
    );
  });

  it("shows an empty state when there are no events", () => {
    render(<ActivityTimeline events={[]} emptyTitle="Nothing yet" emptyDescription="Run a job." />);
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
    expect(screen.getByText("Run a job.")).toBeInTheDocument();
  });
});

describe("StatusPill", () => {
  it("renders a readable status label", () => {
    render(<StatusPill value="PENDING_REVIEW" />);
    expect(screen.getByText("Review needed")).toBeInTheDocument();
  });
});
