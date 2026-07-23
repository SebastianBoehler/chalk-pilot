import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SessionRecording } from "@/features/recording/use-session-recording";
import { RecordingControls } from "./recording-controls";

function recording(
  overrides: Partial<SessionRecording> = {},
): SessionRecording {
  return {
    canStart: true,
    canStop: false,
    durationMs: 0,
    error: undefined,
    replayUrl: undefined,
    start: vi.fn(async () => undefined),
    status: "idle",
    stop: vi.fn(async () => undefined),
    noteCueStart: vi.fn(),
    noteCueEnd: vi.fn(),
    attachTranscript: vi.fn(),
    noteCanvas: vi.fn(),
    ...overrides,
  };
}

describe("RecordingControls", () => {
  it("describes one synchronized five-track session recording", () => {
    const state = recording();

    render(<RecordingControls recording={state} />);

    expect(
      screen.getByText(
        /board, speaker, canvas, microphone, and desktop audio/i,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Start session recording" }),
    ).toBeEnabled();
    expect(screen.queryByText(/3 videos/i)).not.toBeInTheDocument();
  });

  it("keeps explicit stop available after a background interruption", () => {
    const state = recording({
      canStart: false,
      canStop: true,
      durationMs: 2_000,
      error: "The board track was interrupted.",
      status: "error",
    });

    render(<RecordingControls recording={state} />);

    expect(
      screen.getByRole("button", { name: "Stop recording" }),
    ).toBeEnabled();
  });

  it("opens the durable replay after finalization", () => {
    const state = recording({
      canStart: false,
      canStop: false,
      durationMs: 3_200,
      replayUrl: "/replay/session-1",
      status: "complete",
    });

    render(<RecordingControls recording={state} />);

    expect(screen.getByRole("link", { name: "Open replay" })).toHaveAttribute(
      "href",
      "/replay/session-1",
    );
    expect(screen.queryByText(/download/i)).not.toBeInTheDocument();
  });

  it("keeps an interrupted recording visibly incomplete but replayable", () => {
    const state = recording({
      canStart: false,
      canStop: false,
      durationMs: 3_200,
      error: "The board track was interrupted.",
      replayUrl: "/replay/session-1",
      status: "error",
    });

    const view = render(<RecordingControls recording={state} />);

    expect(view.container).toHaveTextContent("Needs attention · 0:03");
    expect(view.container).toHaveTextContent(
      "The board track was interrupted.",
    );
    expect(view.container.querySelector("a")).toHaveAttribute(
      "href",
      "/replay/session-1",
    );
    expect(view.container.querySelector("button")).not.toBeInTheDocument();
  });

  it("cannot stop or reset its controller-owned recording when remounted", () => {
    const state = recording({
      canStart: false,
      canStop: true,
      durationMs: 61_000,
      status: "recording",
    });
    const view = render(<RecordingControls recording={state} />);

    expect(view.getByText("Recording · 1:01")).toBeVisible();
    view.rerender(<></>);
    view.rerender(<RecordingControls recording={state} />);

    expect(view.getByText("Recording · 1:01")).toBeVisible();
    expect(state.stop).not.toHaveBeenCalled();
    expect(view.container.querySelector("button")).toHaveTextContent(
      "Stop recording",
    );
    expect(view.container.querySelector("button")).toBeEnabled();
  });
});
