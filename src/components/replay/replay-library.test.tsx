import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RecordingSummary } from "@/features/recording/schema";
import { ReplayLibrary } from "./replay-library";

const summary: RecordingSummary = {
  sessionId: "session-1",
  state: "complete",
  startedAt: "2026-07-23T10:00:00.000Z",
  finalizedAt: "2026-07-23T10:45:00.000Z",
  durationMs: 2_700_000,
  availableTracks: ["board", "canvas", "microphone"],
};

describe("ReplayLibrary", () => {
  afterEach(cleanup);

  it("shows a calm empty state", () => {
    render(<ReplayLibrary summaries={[]} />);

    expect(screen.getByText("No recordings yet.")).toBeVisible();
    expect(
      screen.getByText(/Finish a recording to review it here/i),
    ).toBeVisible();
  });

  it("shows a visible loading error", () => {
    render(
      <ReplayLibrary
        error="The recordings directory could not be read."
        summaries={[]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The recordings directory could not be read.",
    );
  });

  it("links a recording with time, duration, state, and tracks", () => {
    render(<ReplayLibrary summaries={[summary]} />);

    expect(
      screen.getByRole("link", { name: /open recording/i }),
    ).toHaveAttribute("href", "/replay/session-1");
    expect(screen.getByText(/45:00 · Complete/)).toBeVisible();
    expect(screen.getByText(/Board · Canvas · Microphone/)).toBeVisible();
    expect(screen.getByText(/23 Jul 2026/)).toBeVisible();
  });
});
