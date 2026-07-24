import { z } from "zod";
import type { WorkspaceRepository } from "@/features/workspace/repository";
import { identifierSchema } from "@/features/workspace/schema";
import { StudySourceParseError } from "./parsers";
import {
  StudyPackLimitError,
  StudyPackNotFoundError,
  type StudyPackRepository,
} from "./repository";
import { studySearchRequestSchema } from "./schema";

const createPackSchema = z.object({
  title: z.string().trim().min(1).max(120),
});

export function createStudyPackApi(
  repository: StudyPackRepository,
  workspace?: WorkspaceRepository,
) {
  return {
    list: () => safely(async () => Response.json(await repository.listPacks())),

    create: (request: Request) =>
      safely(async () => {
        const input = createPackSchema.parse(await request.json());
        return Response.json(await repository.createPack(input.title), {
          status: 201,
        });
      }),

    read: (packId: string) =>
      safely(async () => Response.json(await repository.readPack(packId))),

    upload: (packId: string, request: Request) =>
      safely(async () => {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File)) throw new InvalidStudyUploadError();
        const result = await repository.uploadSource(packId, {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          bytes: new Uint8Array(await file.arrayBuffer()),
        });
        return Response.json(result, { status: 201 });
      }),

    sessionOutline: (sessionId: string) =>
      safely(async () => {
        const packId = await selectedPackId(workspace, sessionId);
        return Response.json(packId ? await repository.outline(packId) : null);
      }),

    sessionSearch: (sessionId: string, request: Request) =>
      safely(async () => {
        const packId = await selectedPackId(workspace, sessionId);
        if (!packId) return Response.json({ results: [] });
        const input = studySearchRequestSchema.parse(await request.json());
        return Response.json({
          results: await repository.search(packId, input.query, input.limit),
        });
      }),

    sessionPassage: (sessionId: string, rawChunkId: string) =>
      safely(async () => {
        const chunkId = identifierSchema.parse(rawChunkId);
        const packId = await selectedPackId(workspace, sessionId);
        if (!packId)
          return Response.json(
            { error: "No study pack is selected." },
            { status: 404 },
          );
        const passage = await repository.passage(packId, chunkId);
        return passage
          ? Response.json(passage)
          : Response.json(
              { error: "Study passage not found." },
              { status: 404 },
            );
      }),
  };
}

class InvalidStudyUploadError extends Error {}

async function selectedPackId(
  workspace: WorkspaceRepository | undefined,
  sessionId: string,
) {
  if (!workspace) throw new Error("Workspace repository is required.");
  return (await workspace.readSession(sessionId)).studyPackId;
}

async function safely(operation: () => Promise<Response>): Promise<Response> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof StudyPackNotFoundError) {
      return Response.json({ error: "Study pack not found." }, { status: 404 });
    }
    if (error instanceof StudyPackLimitError) {
      return Response.json({ error: error.message }, { status: 413 });
    }
    if (error instanceof StudySourceParseError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof Error && error.message.startsWith("Unknown session")) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }
    if (
      error instanceof z.ZodError ||
      error instanceof SyntaxError ||
      error instanceof InvalidStudyUploadError
    ) {
      return Response.json(
        { error: "The request was invalid." },
        { status: 400 },
      );
    }
    throw error;
  }
}

export type StudyPackApi = ReturnType<typeof createStudyPackApi>;
