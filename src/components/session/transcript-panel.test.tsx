import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playCompletionChime } from "@/features/audio/completion-chime";
import { TranscriptPanel } from "./transcript-panel";

vi.mock("@/features/audio/completion-chime", () => ({
  playCompletionChime: vi.fn(),
}));

describe("TranscriptPanel", () => {
  beforeEach(() => {
    vi.mocked(playCompletionChime).mockClear();
  });

  it("distinguishes tool activity from spoken turns", () => {
    render(
      <TranscriptPanel
        transcript={[
          {
            sourceId: "message-1",
            role: "user",
            text: "Show the mechanism.",
          },
          {
            sourceId: "tool-1",
            role: "tool",
            toolName: "focus_canvas",
            status: "completed",
            text: "Target: mechanism · Focused: yes",
          },
        ]}
      />,
    );

    expect(screen.getByText("You:")).toBeVisible();
    expect(screen.getByText("Focus canvas")).toBeVisible();
    expect(screen.getByText("Completed")).toBeVisible();
    expect(screen.getByText("Target: mechanism · Focused: yes")).toBeVisible();
    expect(playCompletionChime).not.toHaveBeenCalled();
  });

  it("chimes once when a visible tool call completes", () => {
    const view = render(
      <TranscriptPanel
        transcript={[
          {
            sourceId: "tool-1",
            role: "tool",
            toolName: "focus_canvas",
            status: "running",
            text: "Target: mechanism",
          },
        ]}
      />,
    );

    view.rerender(
      <TranscriptPanel
        transcript={[
          {
            sourceId: "tool-1",
            role: "tool",
            toolName: "focus_canvas",
            status: "completed",
            text: "Target: mechanism · Focused: yes",
          },
        ]}
      />,
    );
    view.rerender(
      <TranscriptPanel
        transcript={[
          {
            sourceId: "tool-1",
            role: "tool",
            toolName: "focus_canvas",
            status: "completed",
            text: "Target: mechanism · Focused: yes",
          },
        ]}
      />,
    );

    expect(playCompletionChime).toHaveBeenCalledOnce();
  });
});
