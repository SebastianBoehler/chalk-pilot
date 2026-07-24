import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CanvasNavigation } from "@/features/canvas-navigation/schema";
import type { CanvasState } from "@/features/workspace/schema";
import { LearningWorkspace } from "./learning-workspace";

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn(),
});

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

const recording = {
  canStart: true,
  canStop: false,
  durationMs: 0,
  error: undefined,
  replayUrl: undefined,
  status: "idle" as const,
  start: vi.fn(async () => undefined),
  stop: vi.fn(async () => undefined),
  noteCueStart: vi.fn(),
  noteCueEnd: vi.fn(),
  attachTranscript: vi.fn(),
  noteCanvas: vi.fn(),
};

describe("LearningWorkspace", () => {
  const navigation: CanvasNavigation = {
    requestId: "nav-1",
    targetId: "derivative-cue",
    kind: "focus",
    issuedAt: "2026-07-24T08:00:00.000Z",
  };

  it("makes the learning canvas primary and collapses session controls", async () => {
    const user = userEvent.setup();
    render(
      <LearningWorkspace
        agentState="listening"
        boardNotice="Board images are sent only at turn boundaries."
        canvas={canvas}
        canvasJobError={undefined}
        canvasJobState="building"
        displayConnected
        error={undefined}
        onEnd={vi.fn()}
        onInspect={vi.fn()}
        navigation={navigation}
        onOpenDisplay={vi.fn()}
        onPause={vi.fn()}
        onRecalibrate={vi.fn()}
        paused={false}
        preview={null}
        realtimeConnected
        recording={recording}
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
    expect(screen.getByText("Canvas worker")).toBeVisible();
    expect(screen.getByText("Building visual context…")).toBeVisible();
    const recordingButton = screen.getByRole("button", {
      name: "Start session recording",
    });
    expect(recordingButton).toBeVisible();
    expect(screen.queryByText("Room display")).not.toBeInTheDocument();
    expect(screen.queryByText("Connection test")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Hide session controls" }),
    );

    expect(
      screen.queryByRole("button", { name: "Inspect board now" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show session controls" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        hidden: true,
        name: "Start session recording",
      }),
    ).toBe(recordingButton);
  });

  it("prevents navigation away while a recording is active", () => {
    render(
      <LearningWorkspace
        agentState="listening"
        boardNotice="Board ready."
        canvas={canvas}
        canvasJobError={undefined}
        canvasJobState="idle"
        displayConnected
        error={undefined}
        onEnd={vi.fn()}
        onInspect={vi.fn()}
        navigation={null}
        onOpenDisplay={vi.fn()}
        onPause={vi.fn()}
        onRecalibrate={vi.fn()}
        paused={false}
        preview={null}
        realtimeConnected
        recording={{
          ...recording,
          canStart: false,
          canStop: true,
          status: "recording",
        }}
        transcript={[]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Recalibrate board" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "End session" })).toBeDisabled();
  });
});
