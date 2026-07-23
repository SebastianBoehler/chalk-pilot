// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { CanvasState } from "@/features/workspace/schema";
import { buildCanvasAgentMessages } from "./agent";

const canvas: CanvasState = {
  version: 1,
  focusId: null,
  order: ["existing-note"],
  sections: {
    "existing-note": {
      id: "existing-note",
      kind: "markdown",
      title: "Existing note",
      content: "The learner already compared the two directions.",
      createdAt: "2026-07-23T08:00:00.000Z",
      updatedAt: "2026-07-23T08:00:00.000Z",
    },
  },
};

describe("canvas worker agent context", () => {
  it("includes the bounded canvas snapshot and corrected board image", () => {
    const messages = buildCanvasAgentMessages(
      {
        jobId: "job-1",
        goal: "Add a diagram showing the update direction.",
        artifact: "diagram",
        boardImage: "data:image/jpeg;base64,Ym9hcmQ=",
      },
      canvas,
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ role: "user" });
    expect(JSON.stringify(messages[0])).toContain("existing-note");
    expect(JSON.stringify(messages[0])).toContain(
      "Add a diagram showing the update direction.",
    );
    expect(JSON.stringify(messages[0])).toContain(
      "data:image/jpeg;base64,Ym9hcmQ=",
    );
  });
});
