import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TranscriptPanel } from "./transcript-panel";

describe("TranscriptPanel", () => {
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
  });
});
