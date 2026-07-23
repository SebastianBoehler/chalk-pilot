import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReplayClientPort } from "@/features/replay/client";
import { ReplayLibraryLoader } from "./replay-library-loader";
import { ReplaySessionLoader } from "./replay-session-loader";

function client(overrides: Partial<ReplayClientPort> = {}): ReplayClientPort {
  return {
    list: vi.fn(async () => []),
    manifest: vi.fn(async () => {
      throw new Error("unused");
    }),
    timeline: vi.fn(async () => {
      throw new Error("unused");
    }),
    trackUrl: vi.fn(),
    exportUrl: vi.fn(),
    ...overrides,
  };
}

describe("replay loaders", () => {
  afterEach(cleanup);

  it("loads the recording library from the validated client", async () => {
    render(<ReplayLibraryLoader client={client()} />);

    await waitFor(() =>
      expect(screen.getByText("No recordings yet.")).toBeVisible(),
    );
  });

  it("keeps a malformed session error visible", async () => {
    const replayClient = client({
      manifest: vi.fn(async () => {
        throw new Error("The server returned an invalid recording manifest.");
      }),
      timeline: vi.fn(async () => ({
        transcript: [],
        canvasEvents: [],
      })),
    });

    render(<ReplaySessionLoader client={replayClient} sessionId="session-1" />);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The server returned an invalid recording manifest.",
      ),
    );
  });
});
