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
  navigationEvents: [],
};

describe("ReplayPlayer", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
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
    fireEvent.seeking(canvasVideo);

    fireEvent.click(
      screen.getByRole("button", { name: "Show canvas as primary" }),
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
    const complete = manifest();
    complete.tracks.speaker.byteSize = 100;
    complete.tracks.speaker.durationMs = 10_000;
    complete.tracks.speaker.health = "complete";
    complete.tracks.speaker.interruption = null;
    render(<ReplayPlayer manifest={complete} timeline={timeline} />);
    const board = screen.getByTestId("track-board");
    const speaker = screen.getByTestId("track-speaker");
    const canvasVideo = screen.getByTestId("track-canvas");

    expect(
      screen.getByRole("button", { name: "Show board as primary" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(speaker).toHaveClass("rounded-xl");

    fireEvent.change(screen.getByRole("combobox", { name: "Second view" }), {
      target: { value: "canvas" },
    });

    expect(screen.getByTestId("track-board")).toBe(board);
    expect(screen.getByTestId("track-canvas")).toBe(canvasVideo);
    expect(canvasVideo).toHaveClass("rounded-xl");
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

  it("keeps a long clock leader stable while switching a short interrupted primary", () => {
    const long = manifest();
    long.durationMs = 120_000;
    long.tracks.canvas.health = "interrupted";
    long.tracks.canvas.durationMs = 10_000;
    long.tracks.board.durationMs = 110_000;
    long.tracks.microphone.durationMs = 119_000;
    render(<ReplayPlayer manifest={long} timeline={timeline} />);
    const microphone = screen.getByTestId(
      "track-microphone",
    ) as HTMLAudioElement;
    microphone.currentTime = 75;
    fireEvent.timeUpdate(microphone);

    fireEvent.click(
      screen.getByRole("button", { name: "Show canvas as primary" }),
    );

    expect(screen.getByText("1:15 / 2:00")).toBeVisible();
    expect(microphone.currentTime).toBe(75);
  });

  it("blocks direct playback while a recording is still in progress", () => {
    const active = manifest();
    active.state = "recording";
    active.finalizedAt = null;

    render(<ReplayPlayer manifest={active} timeline={timeline} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This recording is still in progress",
    );
    expect(
      screen.queryByRole("button", { name: "Play" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Downloads" }),
    ).not.toBeInTheDocument();
  });

  it("visibly disables playback when no track has usable duration", () => {
    const empty = manifest();
    for (const track of Object.values(empty.tracks)) {
      track.durationMs = 0;
    }

    render(<ReplayPlayer manifest={empty} timeline={timeline} />);

    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No track has a usable playback duration",
    );
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
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

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

    expect(
      screen.getByRole("button", { name: "Unmute Desktop audio" }),
    ).not.toHaveTextContent("Unmute Desktop audio");
    expect(
      screen
        .getByRole("button", { name: "Unmute Desktop audio" })
        .querySelector("svg"),
    ).toBeInTheDocument();
    expect(microphone.volume).toBe(0.35);
    expect(desktop.muted).toBe(true);
    expect(microphone.muted).toBe(false);
  });

  it("offers individual and portable downloads", () => {
    render(<ReplayPlayer manifest={manifest()} timeline={timeline} />);
    const downloads = screen.getByRole("region", { name: "Downloads" });
    fireEvent.click(within(downloads).getByText("Downloads"));

    expect(
      within(downloads).getByRole("link", { name: "Download board" }),
    ).toHaveAttribute("download", "session-1-board.webm");
    expect(
      within(downloads).getByRole("link", { name: "Download session package" }),
    ).toHaveAttribute("href", "/api/sessions/session-1/recording/export");
  });

  it("keeps replay in a bounded studio without rebuilding semantic artifacts", () => {
    const view = render(
      <ReplayPlayer manifest={manifest()} timeline={timeline} />,
    );

    expect(view.container.querySelector("[data-replay-studio]")).toHaveClass(
      "lg:h-[calc(100svh-4rem)]",
    );
    expect(screen.queryByText("Canvas at this moment")).not.toBeInTheDocument();
    expect(screen.queryByText("First concept")).not.toBeInTheDocument();
  });
});
