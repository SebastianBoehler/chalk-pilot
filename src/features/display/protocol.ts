import { z } from "zod";
import {
  canvasStateSchema,
  type CanvasState,
} from "@/features/workspace/schema";
import {
  canvasNavigationSchema,
  type CanvasNavigation,
} from "@/features/canvas-navigation/schema";

export const agentStateSchema = z.enum([
  "idle",
  "listening",
  "thinking",
  "speaking",
  "paused",
  "error",
]);

export type AgentState = z.infer<typeof agentStateSchema>;

export interface DisplaySnapshot {
  canvas: CanvasState;
  agentState: AgentState;
  navigation: CanvasNavigation | null;
}

export type DisplayMessage =
  | { version: 1; type: "ready" }
  | { version: 1; type: "snapshot"; payload: DisplaySnapshot }
  | { version: 1; type: "canvas"; payload: CanvasState }
  | { version: 1; type: "agent_state"; payload: AgentState }
  | { version: 1; type: "navigation"; payload: CanvasNavigation };

const displayMessageSchema = z.discriminatedUnion("type", [
  z.object({ version: z.literal(1), type: z.literal("ready") }),
  z.object({
    version: z.literal(1),
    type: z.literal("snapshot"),
    payload: z.object({
      canvas: canvasStateSchema,
      agentState: agentStateSchema,
      navigation: canvasNavigationSchema.nullable(),
    }),
  }),
  z.object({
    version: z.literal(1),
    type: z.literal("canvas"),
    payload: canvasStateSchema,
  }),
  z.object({
    version: z.literal(1),
    type: z.literal("agent_state"),
    payload: agentStateSchema,
  }),
  z.object({
    version: z.literal(1),
    type: z.literal("navigation"),
    payload: canvasNavigationSchema,
  }),
]);

export function parseDisplayMessage(value: unknown): DisplayMessage | null {
  const parsed = displayMessageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
