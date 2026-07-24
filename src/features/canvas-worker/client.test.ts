import { describe, expect, it, vi } from "vitest";
import type { CanvasState } from "@/features/workspace/schema";
import { CanvasJobClient } from "./client";

const canvas: CanvasState = {
  version: 1,
  focusId: "mechanism",
  order: ["mechanism"],
  sections: {
    mechanism: {
      id: "mechanism",
      kind: "markdown",
      title: "Mechanism",
      content: "Explain the mechanism.",
      createdAt: "2026-07-24T08:00:00.000Z",
      updatedAt: "2026-07-24T08:00:00.000Z",
    },
  },
};

describe("CanvasJobClient", () => {
  it("emits a fresh focus navigation after a successful worker result", async () => {
    const onNavigation = vi.fn();
    const client = new CanvasJobClient({
      sessionId: "session-1",
      fetcher: vi.fn(async () =>
        Response.json({ jobId: "job-1", summary: "Added mechanism.", canvas }),
      ),
      getBoardImage: () => null,
      onCanvasChanged: vi.fn(),
      onCompleted: vi.fn(),
      onNavigation,
      createJobId: () => "job-1",
    });

    client.delegate({
      artifact: "explanation",
      goal: "Explain the mechanism.",
    });
    await client.whenIdle();

    expect(onNavigation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "focus", targetId: "mechanism" }),
    );
  });
});
