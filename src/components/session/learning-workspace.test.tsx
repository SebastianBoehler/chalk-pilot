import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CanvasState } from "@/features/workspace/schema";
import { LearningWorkspace } from "./learning-workspace";

const canvas: CanvasState = {
  version: 1,
  focusId: "derivative-cue",
  order: ["derivative-cue"],
  sections: {
    "derivative-cue": {
      id: "derivative-cue",
      kind: "markdown",
      title: "Derivative cue",
      content: "Compare the local slopes before calculating.",
      createdAt: "2026-07-23T08:00:00.000Z",
      updatedAt: "2026-07-23T08:00:00.000Z",
    },
  },
};

describe("LearningWorkspace", () => {
  it("makes the learning canvas primary and collapses session controls", async () => {
    const user = userEvent.setup();
    render(
      <LearningWorkspace
        agentState="listening"
        boardNotice="Board images are sent only at turn boundaries."
        canvas={canvas}
        diagnostic=""
        displayConnected
        error={undefined}
        onDiagnosticChange={vi.fn()}
        onDiagnosticSubmit={vi.fn()}
        onEnd={vi.fn()}
        onInspect={vi.fn()}
        onOpenDisplay={vi.fn()}
        onPause={vi.fn()}
        onRecalibrate={vi.fn()}
        paused={false}
        preview={null}
        realtimeConnected
        transcript={[]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Derivative cue" }),
    ).toBeVisible();
    expect(
      screen.getByText("Compare the local slopes before calculating."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Inspect board now" }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Hide session controls" }),
    );

    expect(
      screen.queryByRole("button", { name: "Inspect board now" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show session controls" }),
    ).toBeVisible();
  });
});
