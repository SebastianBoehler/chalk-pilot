import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSessionRecording } from "@/features/recording/use-session-recording";
import { RecordingControls } from "./recording-controls";

vi.mock("@/features/recording/use-session-recording", () => ({
  useSessionRecording: vi.fn(),
}));

describe("RecordingControls", () => {
  it("describes one synchronized five-track session recording", () => {
    vi.mocked(useSessionRecording).mockReturnValue({
      canStart: true,
      canStop: false,
      downloads: [],
      error: undefined,
      replayUrl: undefined,
      start: vi.fn(),
      status: "idle",
      stop: vi.fn(),
    });

    render(<RecordingControls boardPreview="data:image/png;base64,board" />);

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
    vi.mocked(useSessionRecording).mockReturnValue({
      canStart: false,
      canStop: true,
      downloads: [],
      error: "The board track was interrupted.",
      replayUrl: undefined,
      start: vi.fn(),
      status: "error",
      stop: vi.fn(),
    });

    render(<RecordingControls boardPreview={null} />);

    expect(
      screen.getByRole("button", { name: "Stop recording" }),
    ).toBeEnabled();
  });
});
