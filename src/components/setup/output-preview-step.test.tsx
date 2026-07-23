import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardController } from "@/features/board/board-controller";
import type { PersonBox } from "@/features/recording/presenter-tracker";
import { OutputPreviewStep } from "./output-preview-step";

const { createStreams } = vi.hoisted(() => ({
  createStreams: vi.fn(),
}));

vi.mock("@/features/recording/derived-video-streams", () => ({
  createDerivedVideoStreams: createStreams,
}));

const presenter: PersonBox = {
  id: "pose-0",
  x: 0.1,
  y: 0.1,
  width: 0.3,
  height: 0.7,
};

describe("OutputPreviewStep", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    createStreams.mockReturnValue({
      board: {} as MediaStream,
      speaker: {} as MediaStream,
      confirmPresenter: vi.fn(),
      stop: vi.fn(),
      updateBoard: vi.fn(async () => undefined),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    createStreams.mockReset();
  });

  it("requires a click-confirmed detected presenter before continuation", () => {
    const onContinue = vi.fn();
    renderPreview(onContinue, "room-wide");
    const options = createStreams.mock.calls[0]?.[1] as {
      onDetections: (boxes: PersonBox[]) => void;
    };

    expect(
      screen.getByRole("button", { name: "Outputs look right" }),
    ).toBeDisabled();
    act(() => options.onDetections([presenter]));
    const surface = screen.getByRole("button", {
      name: "Select presenter from full camera",
    });
    vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
      bottom: 500,
      height: 500,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.click(surface, { clientX: 160, clientY: 200 });
    fireEvent.click(screen.getByRole("button", { name: "Outputs look right" }));

    expect(
      createStreams.mock.results[0]?.value.confirmPresenter,
    ).toHaveBeenCalledWith(presenter);
    expect(screen.getByText("Presenter confirmed")).toBeVisible();
    expect(onContinue).toHaveBeenCalledWith(presenter);
  });

  it("surfaces model errors and temporary presenter loss", () => {
    renderPreview(vi.fn(), "room-wide");
    const options = createStreams.mock.calls[0]?.[1] as {
      onDetections: (boxes: PersonBox[]) => void;
      onTrackingError: (message: string) => void;
      onTrackingState: (state: {
        box: PersonBox;
        lossCount: number;
        status: "tracking" | "lost";
      }) => void;
    };

    act(() => options.onTrackingError("Pose model unavailable."));
    expect(screen.getByText("Pose model unavailable.")).toBeVisible();

    act(() => {
      options.onTrackingState({
        box: presenter,
        lossCount: 1,
        status: "lost",
      });
    });
    expect(screen.getByText("Presenter temporarily lost")).toBeVisible();
  });

  it("skips presenter tracking for a board-focused camera", () => {
    const onContinue = vi.fn();
    renderPreview(onContinue, "board-focused");

    expect(createStreams).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        cameraUse: "board-focused",
        presenter: null,
      }),
    );
    expect(
      screen.queryByRole("button", {
        name: "Select presenter from full camera",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Outputs look right" }));
    expect(onContinue).toHaveBeenCalledWith(undefined);
  });
});

function renderPreview(
  onContinue: (presenter?: PersonBox) => void,
  cameraUse: "room-wide" | "board-focused",
) {
  const sourceVideo = document.createElement("video");
  Object.defineProperties(sourceVideo, {
    videoHeight: { configurable: true, value: 1_200 },
    videoWidth: { configurable: true, value: 1_920 },
  });
  vi.spyOn(sourceVideo, "play").mockResolvedValue();
  const sourceStream = {
    getVideoTracks: () => [{ readyState: "live" }],
  } as unknown as MediaStream;
  const board = {
    sample: vi.fn(async () => "data:image/png;base64,board"),
  } as unknown as BoardController;

  return render(
    <OutputPreviewStep
      board={board}
      cameraUse={cameraUse}
      corners={[
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ]}
      onBack={vi.fn()}
      onContinue={onContinue}
      sourceStream={sourceStream}
      sourceVideo={sourceVideo}
    />,
  );
}
