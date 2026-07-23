import { z } from "zod";
import type { WorkspaceRepository } from "./repository";
import {
  canvasSectionInputSchema,
  identifierSchema,
  learnerMemoryInputSchema,
} from "./schema";

const canvasMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("append"),
    section: canvasSectionInputSchema,
  }),
  z.object({
    action: z.literal("update"),
    section: z.object({
      id: identifierSchema,
      title: z.string().trim().min(1).max(120).optional(),
      content: z.string().trim().min(1).max(20_000).optional(),
    }),
  }),
  z.object({
    action: z.literal("focus"),
    sectionId: identifierSchema.nullable(),
  }),
]);

export function createWorkspaceApi(repository: WorkspaceRepository) {
  async function createSession() {
    return Response.json(await repository.createSession(), { status: 201 });
  }

  async function getCanvas(sessionId: string) {
    return safely(async () =>
      Response.json(await repository.readCanvas(sessionId)),
    );
  }

  async function mutateCanvas(sessionId: string, request: Request) {
    return safely(async () => {
      const mutation = canvasMutationSchema.parse(await request.json());
      switch (mutation.action) {
        case "append":
          return Response.json(
            await repository.appendSection(sessionId, mutation.section),
          );
        case "update":
          return Response.json(
            await repository.updateSection(sessionId, mutation.section),
          );
        case "focus":
          return Response.json(
            await repository.setFocus(sessionId, mutation.sectionId),
          );
      }
    });
  }

  async function remember(sessionId: string, request: Request) {
    return safely(async () => {
      await repository.readCanvas(sessionId);
      const input = learnerMemoryInputSchema.parse(await request.json());
      return Response.json(await repository.rememberLearner(input));
    });
  }

  return { createSession, getCanvas, mutateCanvas, remember };
}

async function safely(operation: () => Promise<Response>): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Unknown session")) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return Response.json(
        { error: "The request was invalid." },
        { status: 400 },
      );
    }
    throw error;
  }
}
