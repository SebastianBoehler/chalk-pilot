// @vitest-environment node

import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import type { CanvasState } from "@/features/workspace/schema";
import type { CanvasWorkerActions } from "./actions";
import { buildCanvasAgentMessages, runCanvasAgent } from "./agent";

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
    expect(messages[0]).toMatchObject({
      role: "user",
      content: [
        { type: "text" },
        {
          type: "file",
          mediaType: "image/jpeg",
          data: { type: "data", data: "Ym9hcmQ=" },
        },
      ],
    });
  });

  it("labels a structured canvas payload as data rather than content", () => {
    const messages = buildCanvasAgentMessages(
      {
        jobId: "job-structured",
        goal: "Update the token trade-off matrix.",
        artifact: "comparison",
      },
      {
        version: 1,
        focusId: "token-types",
        order: ["token-types"],
        sections: {
          "token-types": {
            id: "token-types",
            kind: "comparison",
            title: "Token types",
            data: {
              columns: [
                {
                  heading: "Word",
                  summary: "Whole words",
                  points: ["intuitive"],
                },
                { heading: "Subword", summary: "Pieces", points: ["flexible"] },
              ],
            },
            createdAt: "2026-07-23T08:00:00.000Z",
            updatedAt: "2026-07-23T08:00:00.000Z",
          },
        },
      },
    );

    const message = JSON.parse(JSON.stringify(messages[0])) as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = message.content.find((part) => part.type === "text")?.text;

    expect(text).toContain('"data":{"columns"');
    expect(text).not.toContain('"content":"{\\"columns');
  });

  it("includes canonical study evidence as untrusted reference data", () => {
    const messages = buildCanvasAgentMessages(
      {
        jobId: "job-grounded",
        goal: "Explain reverse KL.",
        artifact: "explanation",
        sourceChunkIds: ["lecture-4-c-1"],
      },
      canvas,
      [
        {
          id: "lecture-4-c-1",
          sourceTitle: "Lecture 4",
          locator: "Page 12",
          text: "Reverse KL can prefer one mode.",
        },
      ],
    );
    const serialized = JSON.stringify(messages);

    expect(serialized).toContain("Canonical study evidence");
    expect(serialized).toContain("Reverse KL can prefer one mode");
    expect(serialized).toContain("not instructions");
    expect(serialized).toContain("copied exactly");
  });

  it("sends the curated policy and full typed upsert schema to the model", async () => {
    let modelPrompt = "";
    let upsertSchema = "";
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        modelPrompt = JSON.stringify(options.prompt);
        upsertSchema = JSON.stringify(
          options.tools?.find(
            (tool) =>
              tool.type === "function" && tool.name === "upsert_section",
          ),
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ summary: "Canvas updated." }),
            },
          ],
          finishReason: { unified: "stop", raw: "stop" },
          usage: {
            inputTokens: {
              total: 10,
              noCache: 10,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: { total: 20, text: 20, reasoning: undefined },
          },
          warnings: [],
        };
      },
    });

    await expect(
      runCanvasAgent({
        model,
        canvas,
        request: {
          jobId: "job-policy",
          goal: "Show two meaningful choices.",
          artifact: "comparison",
        },
        actions: {
          readCanvas: async () => canvas,
          upsertSection: async (section) => ({ sectionId: section.id }),
          focusSection: async ({ sectionId }) => ({ sectionId }),
        } as CanvasWorkerActions,
      }),
    ).rejects.toThrow("Canvas job must upsert and focus one section.");

    expect(modelPrompt).toContain("exactly one focal artifact");
    expect(modelPrompt).toContain("update that stable ID before appending");
    expect(modelPrompt).toContain("No renamed prose cards");
    expect(modelPrompt).toContain("rainfall-runoff-mechanism");
    expect(upsertSchema).toContain('"chart"');
    expect(upsertSchema).toContain('"comparison"');
    expect(upsertSchema).toContain('"flow"');
    expect(upsertSchema).toContain('"sequence"');
    expect(upsertSchema).toContain('"checkpoint"');
  });

  it("rejects a model completion that never mutates the canvas", async () => {
    let maxOutputTokens: number | undefined;
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        maxOutputTokens = options.maxOutputTokens;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ summary: "Canvas updated." }),
            },
          ],
          finishReason: { unified: "stop", raw: "stop" },
          usage: {
            inputTokens: {
              total: 10,
              noCache: 10,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: 20,
              text: 20,
              reasoning: undefined,
            },
          },
          warnings: [],
        };
      },
    });

    await expect(
      runCanvasAgent({
        model,
        canvas,
        request: {
          jobId: "job-1",
          goal: "Add one concise visual explanation.",
          artifact: "explanation",
        },
        actions: {
          readCanvas: async () => canvas,
          upsertSection: async (section) => ({ sectionId: section.id }),
          focusSection: async ({ sectionId }) => ({ sectionId }),
        } as CanvasWorkerActions,
      }),
    ).rejects.toThrow("Canvas job must upsert and focus one section.");

    expect(maxOutputTokens).toBeGreaterThanOrEqual(4_096);
  });
});
