import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSessionRecording } from "@/features/recording/use-session-recording";
import { RecordingControls } from "./recording-controls";

vi.mock("@/features/recording/use-session-recording", () => ({
  useSessionRecording: vi.fn(),
}));

describe("RecordingControls", () => {
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
