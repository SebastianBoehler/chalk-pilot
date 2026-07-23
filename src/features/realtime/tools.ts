import { tool } from "@openai/agents";
import { z } from "zod";
import {
  canvasSectionInputSchema,
  canvasStateSchema,
  identifierSchema,
  type CanvasSectionInput,
  type CanvasState,
} from "@/features/workspace/schema";

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type BoardInspectionStatus = "sent" | "unchanged" | "unavailable";

interface ToolRuntime {
  sessionId: string;
  inspectBoard: () => Promise<BoardInspectionStatus>;
  getEvidenceId: () => string;
  onCanvasChanged: (canvas: CanvasState) => void;
  fetcher?: Fetcher;
}

const updateSectionSchema = z.object({
  id: identifierSchema,
  title: z.string().trim().min(1).max(120).nullable(),
  content: z.string().trim().min(1).max(20_000),
});

const rememberLearnerSchema = z.object({
  claim: z.string().trim().min(1).max(500),
  scope: z.string().trim().min(1).max(120),
  confidence: z.number().min(0).max(1),
});

export function createChalkPilotActions(runtime: ToolRuntime) {
  const fetcher = runtime.fetcher ?? fetch;

  async function mutateCanvas(body: unknown) {
    const response = await fetcher(
      `/api/sessions/${runtime.sessionId}/canvas`,
      jsonPost(body),
    );
    const canvas = canvasStateSchema.parse(await successfulJson(response));
    runtime.onCanvasChanged(canvas);
    return canvas;
  }

  return {
    async inspectBoard() {
      const status = await runtime.inspectBoard();
      const messages = {
        sent: "The latest corrected board image is now available.",
        unchanged: "The board has not materially changed since the last image.",
        unavailable: "No confirmed board image is currently available.",
      };
      return { status, message: messages[status] };
    },

    async setFocus(input: { sectionId: string | null }) {
      await mutateCanvas({ action: "focus", sectionId: input.sectionId });
      return { focused: input.sectionId };
    },

    async appendSection(section: CanvasSectionInput) {
      const validSection = canvasSectionInputSchema.parse(section);
      await mutateCanvas({ action: "append", section: validSection });
      return { appended: validSection.id };
    },

    async updateSection(input: z.infer<typeof updateSectionSchema>) {
      const validInput = updateSectionSchema.parse(input);
      await mutateCanvas({
        action: "update",
        section: {
          id: validInput.id,
          content: validInput.content,
          ...(validInput.title ? { title: validInput.title } : {}),
        },
      });
      return { updated: validInput.id };
    },

    async rememberLearner(input: z.infer<typeof rememberLearnerSchema>) {
      const validInput = rememberLearnerSchema.parse(input);
      await successfulJson(
        await fetcher(
          `/api/sessions/${runtime.sessionId}/memory`,
          jsonPost({
            ...validInput,
            evidence: runtime.getEvidenceId(),
          }),
        ),
      );
      return { remembered: true };
    },
  };
}

export function createChalkPilotTools(runtime: ToolRuntime) {
  const actions = createChalkPilotActions(runtime);
  return [
    tool({
      name: "inspect_board",
      description:
        "Attach the newest confirmed board crop when visual evidence is needed.",
      parameters: z.object({}),
      execute: actions.inspectBoard,
    }),
    tool({
      name: "set_focus",
      description:
        "Emphasize one existing canvas section, or clear focus with null.",
      parameters: z.object({ sectionId: identifierSchema.nullable() }),
      execute: actions.setFocus,
    }),
    tool({
      name: "append_section",
      description:
        "Append durable visual context to the room display. Prefer this over long speech.",
      parameters: z.object({
        id: identifierSchema,
        kind: z.enum(["markdown", "math", "mermaid", "image", "youtube"]),
        title: z.string().trim().min(1).max(120),
        content: z.string().trim().min(1).max(20_000),
      }),
      execute: actions.appendSection,
    }),
    tool({
      name: "update_section",
      description: "Replace an existing canvas section with corrected content.",
      parameters: updateSectionSchema,
      execute: actions.updateSection,
    }),
    tool({
      name: "remember_learner",
      description:
        "Store a concise, evidence-linked learning preference or difficulty.",
      parameters: rememberLearnerSchema,
      execute: actions.rememberLearner,
    }),
  ];
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function successfulJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error("ChalkPilot could not save that learning artifact.");
  }
  return response.json();
}
