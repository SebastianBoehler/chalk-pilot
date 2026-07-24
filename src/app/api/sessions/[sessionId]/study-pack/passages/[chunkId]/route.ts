import { createStudyPackApi } from "@/features/study-pack/api";
import { studyPackRepository } from "@/features/study-pack/default-repository";
import { workspaceRepository } from "@/features/workspace/default-repository";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ sessionId: string; chunkId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId, chunkId } = await context.params;
  return createStudyPackApi(
    studyPackRepository,
    workspaceRepository,
  ).sessionPassage(sessionId, chunkId);
}
