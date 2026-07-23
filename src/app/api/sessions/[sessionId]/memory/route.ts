import { createWorkspaceApi } from "@/features/workspace/api";
import { workspaceRepository } from "@/features/workspace/default-repository";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  return createWorkspaceApi(workspaceRepository).remember(sessionId, request);
}
