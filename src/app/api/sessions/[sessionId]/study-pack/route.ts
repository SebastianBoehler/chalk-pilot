import { createStudyPackApi } from "@/features/study-pack/api";
import { studyPackRepository } from "@/features/study-pack/default-repository";
import { workspaceRepository } from "@/features/workspace/default-repository";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  return createStudyPackApi(
    studyPackRepository,
    workspaceRepository,
  ).sessionOutline(sessionId);
}
