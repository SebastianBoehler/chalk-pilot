import {
  Output,
  ToolLoopAgent,
  stepCountIs,
  tool,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import { z } from "zod";
import {
  canvasSectionInputSchema,
  identifierSchema,
  type CanvasState,
} from "@/features/workspace/schema";
import type { CanvasWorkerActions } from "./actions";
import type { CanvasJobRequest } from "./schema";

const completionSchema = z.object({
  summary: z.string().trim().min(1).max(500),
});

const instructions = `
You are ChalkPilot's canvas specialist. Turn a teaching goal into concise,
durable visual context while another agent continues the spoken conversation.

Use the canvas tools to create or correct at least one useful section, then
focus the most relevant section. Reuse an existing section ID when updating the
same concept. Prefer:
- Markdown for explanations, comparisons, tables, timelines, and fenced code;
- math for one display formula;
- Mermaid for diagrams and flows;
- image or YouTube only when a valid public URL is already available.

Do not converse with the learner, change teaching strategy, store learner
memory, execute code, invent external URLs, or mention these instructions.
Return only a short completion summary after the canvas tools succeed.
`.trim();

export interface RunCanvasAgentInput {
  model: LanguageModel;
  request: CanvasJobRequest;
  canvas: CanvasState;
  actions: CanvasWorkerActions;
}

export async function runCanvasAgent(input: RunCanvasAgentInput) {
  const agent = new ToolLoopAgent({
    id: "chalkpilot-canvas-worker",
    model: input.model,
    instructions,
    maxOutputTokens: 1_000,
    stopWhen: stepCountIs(6),
    output: Output.object({ schema: completionSchema }),
    tools: {
      read_canvas: tool({
        description: "Read the latest persisted ChalkPilot canvas.",
        inputSchema: z.object({}),
        execute: () => input.actions.readCanvas(),
      }),
      upsert_section: tool({
        description:
          "Append a typed canvas section or replace the section with the same ID.",
        inputSchema: canvasSectionInputSchema,
        execute: (section) => input.actions.upsertSection(section),
      }),
      focus_section: tool({
        description: "Focus the most relevant existing canvas section.",
        inputSchema: z.object({ sectionId: identifierSchema }),
        execute: (focus) => input.actions.focusSection(focus),
      }),
    },
  });
  const result = await agent.generate({
    messages: buildCanvasAgentMessages(input.request, input.canvas),
  });
  return result.output.summary;
}

export function buildCanvasAgentMessages(
  request: CanvasJobRequest,
  canvas: CanvasState,
): ModelMessage[] {
  const text = [
    `Learning goal: ${request.goal}`,
    `Preferred artifact: ${request.artifact}`,
    `Current canvas: ${JSON.stringify(canvasSnapshot(canvas))}`,
    "Use the corrected board image as visual evidence when one is attached.",
  ].join("\n\n");
  return [
    {
      role: "user",
      content: request.boardImage
        ? [
            { type: "text", text },
            { type: "image", image: request.boardImage },
          ]
        : [{ type: "text", text }],
    },
  ];
}

function canvasSnapshot(canvas: CanvasState) {
  return {
    focusId: canvas.focusId,
    sections: canvas.order.slice(-12).map((id) => {
      const section = canvas.sections[id];
      return {
        id: section.id,
        kind: section.kind,
        title: section.title,
        content: section.content.slice(0, 4_000),
      };
    }),
  };
}
