import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  RecordingManifest,
  ReplayTimeline,
  TrackKind,
} from "@/features/recording/schema";
import type { CanvasState } from "@/features/workspace/schema";
import { ReplayPlayer } from "./replay-player";

const timestamp = "2026-07-23T10:00:00.000Z";
const videoTracks: TrackKind[] = ["board", "speaker", "canvas"];

function canvas(title: string): CanvasState {
  return {
    version: 1,
    focusId: "concept",
    order: ["concept"],
    sections: {
      concept: {
        id: "concept",
        kind: "markdown",
        title,
        content: `${title} explanation`,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    },
  };
}

function manifest(): RecordingManifest {
  const tracks = Object.fromEntries(
    ["board", "speaker", "canvas", "microphone", "desktop-audio"].map(
      (kind) => [
        kind,
        {
          kind,
          health: kind === "speaker" ? "interrupted" : "complete",
          mimeType: kind.includes("audio") ? "audio/webm" : "video/webm",
          durationMs: kind === "speaker" ? 0 : 10_000,
          byteSize: kind === "speaker" ? 0 : 100,
          path: `tracks/${kind}.webm`,
          acknowledgedSequences: kind === "speaker" ? [] : [0],
          missingSequences: [],
          interruption:
            kind === "speaker"
              ? { message: "Presenter was lost.", at: timestamp }
              : null,
        },
      ],
    ),
  ) as unknown as RecordingManifest["tracks"];
  return {
    schemaVersion: 1,
    sessionId: "session-1",
    state: "interrupted",
    startedAt: timestamp,
    finalizedAt: "2026-07-23T10:00:10.000Z",
    durationMs: 10_000,
    tracks,
    transcriptPath: "transcript.json",
    canvasEventsPath: "canvas-events.json",
  };
}

const timeline: ReplayTimeline = {
  transcript: [
    {
      type: "transcript",
      speaker: "user",
      startMs: 1_000,
      endMs: 2_000,
      text: "What does this mean?",
    },
    {
      type: "transcript",
      speaker: "assistant",
      startMs: 3_000,
      endMs: 4_000,
      text: "Look at the second step.",
    },
  ],
  canvasEvents: [
    { type: "canvas", offsetMs: 0, revision: canvas("First concept") },
    { type: "canvas", offsetMs: 2_500, revision: canvas("Second concept") },
  ],
};

describe("ReplayPlayer", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(
      async () => undefined,
    );
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(
      () => undefined,
    );
  });

  it("keeps every recoverable source mounted while switching the primary view", () => {
    render(<ReplayPlayer manifest={manifest()} timeline={timeline} />);
    const board = screen.getByTestId("track-board") as HTMLVideoElement;
    const canvasVideo = screen.getByTestId("track-canvas") as HTMLVideoElement;
    canvasVideo.currentTime = 6;

    fireEvent.click(
      screen.getByRole("button", { name: "Show board as primary" }),
    );

    expect(screen.getByTestId("track-board")).toBe(board);
    expect(screen.getByTestId("track-canvas")).toBe(canvasVideo);
    expect(board.currentTime).toBe(6);
    for (const kind of videoTracks.filter((kind) => kind !== "speaker")) {
      expect(screen.getByTestId(`track-${kind}`)).not.toHaveAttribute(
        "autoplay",
      );
    }
  });

  it("adds a second view without reloading either mounted source", () => {
    render(<ReplayPlayer manifest={manifest()} timeline={timeline} />);
    const board = screen.getByTestId("track-board");
    const canvasVideo = screen.getByTestId("track-canvas");

    fireEvent.change(screen.getByRole("combobox", { name: "Second view" }), {
      target: { value: "board" },
    });

    expect(screen.getByTestId("track-board")).toBe(board);
    expect(screen.getByTestId("track-canvas")).toBe(canvasVideo);
    expect(board).toHaveClass("rounded-xl");
  });

  it("shows interrupted tracks and remains usable with a partial recording", () => {
    render(<ReplayPlayer manifest={manifest()} timeline={timeline} />);

    expect(screen.getByText(/Speaker: Presenter was lost/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Show speaker as primary" }),
    ).not.toBeInTheDocument();
  });

  it("uses a recovered audio track when no video is available", () => {
    const partial = manifest();
    for (const kind of videoTracks) {
      partial.tracks[kind].byteSize = 0;
      partial.tracks[kind].health = "interrupted";
    }

    render(<ReplayPlayer manifest={partial} timeline={timeline} />);

    expect(screen.getByText("No video track is recoverable.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Play" })).toBeEnabled();
    expect(screen.getByTestId("track-microphone")).toBeInTheDocument();
  });

  it("highlights and seeks transcript cues from the shared timeline", () => {
    render(<ReplayPlayer manifest={manifest()} timeline={timeline} />);
    const canvasVideo = screen.getByTestId("track-canvas") as HTMLVideoElement;
    canvasVideo.currentTime = 1.5;
    fireEvent.timeUpdate(canvasVideo);

    const activeCue = screen
      .getByText("What does this mean?")
      .closest("button");
    expect(activeCue).toHaveAttribute("aria-current", "true");

    fireEvent.click(screen.getByText("Look at the second step."));
    expect(canvasVideo.currentTime).toBe(3);
  });

  it("controls microphone and desktop audio independently", () => {
    render(<ReplayPlayer manifest={manifest()} timeline={timeline} />);
    const microphone = screen.getByTestId(
      "track-microphone",
    ) as HTMLAudioElement;
    const desktop = screen.getByTestId(
      "track-desktop-audio",
    ) as HTMLAudioElement;

    fireEvent.change(screen.getByLabelText("Microphone volume"), {
      target: { value: "0.35" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Mute desktop audio/i }),
    );

    expect(microphone.volume).toBe(0.35);
    expect(desktop.muted).toBe(true);
    expect(microphone.muted).toBe(false);
  });

  it("restores the latest semantic canvas revision at the current offset", () => {
    render(<ReplayPlayer manifest={manifest()} timeline={timeline} />);
    const canvasVideo = screen.getByTestId("track-canvas") as HTMLVideoElement;
    expect(
      screen.getByRole("heading", { name: "First concept" }),
    ).toBeVisible();

    canvasVideo.currentTime = 3;
    fireEvent.timeUpdate(canvasVideo);

    expect(
      screen.getByRole("heading", { name: "Second concept" }),
    ).toBeVisible();
  });

  it("offers individual and portable downloads", () => {
    render(<ReplayPlayer manifest={manifest()} timeline={timeline} />);
    const downloads = screen.getByRole("region", { name: "Downloads" });

    expect(
      within(downloads).getByRole("link", { name: "Download board" }),
    ).toHaveAttribute("href", "/api/sessions/session-1/recording/tracks/board");
    expect(
      within(downloads).getByRole("link", { name: "Download session package" }),
    ).toHaveAttribute("href", "/api/sessions/session-1/recording/export");
  });
});
