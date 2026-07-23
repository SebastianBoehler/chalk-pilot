import { createWorkspaceApi } from "@/features/workspace/api";
import { workspaceRepository } from "@/features/workspace/default-repository";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  return createWorkspaceApi(workspaceRepository).appendTranscript(
    sessionId,
    request,
  );
}
