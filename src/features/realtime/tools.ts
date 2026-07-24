import { tool } from "@openai/agents";
import { z } from "zod";
import {
  canvasArtifactSchema,
  type CanvasDelegationInput,
} from "@/features/canvas-worker/schema";
import {
  canvasTargetIdSchema,
  createCanvasNavigation,
  type CanvasNavigation,
} from "@/features/canvas-navigation/schema";
import {
  canvasNavigationFailure,
  listCanvasTargets,
  resolveCanvasTarget,
} from "@/features/canvas-navigation/targets";
import {
  canvasStateSchema,
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
  getCanvas: () => CanvasState;
  onCanvasChanged: (canvas: CanvasState) => void;
  onNavigation: (navigation: CanvasNavigation, canvas: CanvasState) => void;
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

const canvasTargetSchema = z.object({ targetId: canvasTargetIdSchema });
const canvasHighlightSchema = canvasTargetSchema.extend({
  text: z.string().trim().min(1).max(240),
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

    async listCanvasTargets() {
      return listCanvasTargets(runtime.getCanvas()).map((target) => ({
        id: target.id,
        label: target.label,
        preview: target.text.replace(/\s+/g, " ").trim().slice(0, 240),
      }));
    },

    async focusCanvas(raw: z.infer<typeof canvasTargetSchema>) {
      const input = canvasTargetSchema.parse(raw);
      const target = resolveCanvasTarget(runtime.getCanvas(), input.targetId);
      const canvas = await mutateCanvas({
        action: "focus",
        sectionId: target.sectionId,
      });
      const freshTarget = resolveCanvasTarget(canvas, input.targetId);
      runtime.onNavigation(
        createCanvasNavigation({ kind: "focus", targetId: freshTarget.id }),
        canvas,
      );
      return { focused: true };
    },

    async highlightCanvas(raw: z.infer<typeof canvasHighlightSchema>) {
      const input = canvasHighlightSchema.parse(raw);
      const target = resolveCanvasTarget(runtime.getCanvas(), input.targetId);
      const canvas = await mutateCanvas({
        action: "focus",
        sectionId: target.sectionId,
      });
      const freshTarget = resolveCanvasTarget(canvas, input.targetId);
      const highlight = createCanvasNavigation({
        kind: "highlight",
        targetId: freshTarget.id,
        text: input.text,
      });
      if (canvasNavigationFailure(canvas, highlight)) {
        runtime.onNavigation(
          createCanvasNavigation({ kind: "focus", targetId: freshTarget.id }),
          canvas,
        );
        return {
          focused: true,
          highlighted: false,
          error: "Highlight text is unavailable.",
        };
      }
      runtime.onNavigation(highlight, canvas);
      return { focused: true, highlighted: true };
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
      name: "list_canvas_targets",
      description:
        "List registered semantic canvas targets when a teaching move needs one.",
      parameters: z.object({}),
      execute: actions.listCanvasTargets,
    }),
    tool({
      name: "focus_canvas",
      description:
        "Focus one registered canvas target after it materially supports the teaching move.",
      parameters: canvasTargetSchema,
      execute: actions.focusCanvas,
    }),
    tool({
      name: "highlight_canvas",
      description:
        "Focus a registered target and highlight an exact available semantic phrase.",
      parameters: canvasHighlightSchema,
      execute: actions.highlightCanvas,
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
