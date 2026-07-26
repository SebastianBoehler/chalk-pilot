// @vitest-environment node

import type {
  LanguageModelV4Content,
  LanguageModelV4GenerateResult,
} from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";
import { expect, it } from "vitest";
import type { CanvasState } from "@/features/workspace/schema";
import type { CanvasWorkerActions } from "./actions";
import { runCanvasAgent } from "./agent";

const emptyCanvas: CanvasState = {
  version: 1,
  focusId: null,
  order: [],
  sections: {},
};

it("completes with a model that requires explicit canvas tool choices", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: async ({ responseFormat, toolChoice }) => {
      if (responseFormat) {
        return result(
          [
            {
              type: "text",
              text: JSON.stringify({ summary: "Canvas updated." }),
            },
          ],
          "stop",
        );
      }
      if (
        toolChoice?.type === "tool" &&
        toolChoice.toolName === "upsert_section"
      ) {
        return result(
          [
            {
              type: "tool-call",
              toolCallId: "upsert-1",
              toolName: "upsert_section",
              input: JSON.stringify({
                id: "vector-update",
                kind: "markdown",
                title: "Vector update",
                content: "A concise visual explanation.",
              }),
            },
          ],
          "tool-calls",
        );
      }
      if (
        toolChoice?.type === "tool" &&
        toolChoice.toolName === "focus_section"
      ) {
        return result(
          [
            {
              type: "tool-call",
              toolCallId: "focus-1",
              toolName: "focus_section",
              input: JSON.stringify({ sectionId: "vector-update" }),
            },
          ],
          "tool-calls",
        );
      }
      return result([{ type: "text", text: "Canvas updated." }], "stop");
    },
  });
  const mutations: string[] = [];

  const summary = await runCanvasAgent({
    model,
    canvas: emptyCanvas,
    request: {
      jobId: "job-provider-compat",
      goal: "Show the vector update.",
      artifact: "explanation",
    },
    actions: {
      readCanvas: async () => emptyCanvas,
      upsertSection: async (section) => {
        mutations.push(`upsert:${section.id}`);
        return { sectionId: section.id };
      },
      focusSection: async ({ sectionId }) => {
        mutations.push(`focus:${sectionId}`);
        return { sectionId };
      },
    } as CanvasWorkerActions,
  });

  expect(summary).toBe("Canvas updated.");
  expect(mutations).toEqual(["upsert:vector-update", "focus:vector-update"]);
});

function result(
  content: LanguageModelV4Content[],
  finishReason: "stop" | "tool-calls",
): LanguageModelV4GenerateResult {
  return {
    content,
    finishReason: { unified: finishReason, raw: finishReason },
    usage: {
      inputTokens: {
        total: 10,
        noCache: 10,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: { total: 10, text: 10, reasoning: undefined },
    },
    warnings: [],
  };
}
