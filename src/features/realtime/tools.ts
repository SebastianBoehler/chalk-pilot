import { tool } from "@openai/agents";
import { z } from "zod";
import {
  canvasArtifactSchema,
  type CanvasDelegationInput,
} from "@/features/canvas-worker/schema";
import {
  canvasStateSchema,
  identifierSchema,
  type CanvasState,
} from "@/features/workspace/schema";

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type BoardInspectionStatus = "sent" | "unchanged" | "unavailable";

interface ToolRuntime {
  sessionId: string;
  delegateCanvas: (input: CanvasDelegationInput) => { jobId: string };
  inspectBoard: () => Promise<BoardInspectionStatus>;
  getEvidenceId: () => string;
  onCanvasChanged: (canvas: CanvasState) => void;
  fetcher?: Fetcher;
}

export const canvasDelegationSchema = z.object({
  goal: z.string().trim().min(1).max(2_000),
  artifact: canvasArtifactSchema,
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
    async delegateCanvas(raw: CanvasDelegationInput) {
      const input = canvasDelegationSchema.parse(raw);
      return { accepted: true, ...runtime.delegateCanvas(input) };
    },

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
      name: "delegate_canvas_task",
      description:
        "Delegate durable visual context to the background canvas specialist. Returns immediately.",
      parameters: canvasDelegationSchema,
      execute: actions.delegateCanvas,
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
