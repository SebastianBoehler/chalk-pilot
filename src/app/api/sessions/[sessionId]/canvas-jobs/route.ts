import { createCanvasWorkerApi } from "@/features/canvas-worker/api";
import { createCanvasWorkerService } from "@/features/canvas-worker/service";
import { workspaceRepository } from "@/features/workspace/default-repository";

export const runtime = "nodejs";
export const maxDuration = 60;

const api = createCanvasWorkerApi(
  createCanvasWorkerService({ repository: workspaceRepository }),
);

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  return api.run(sessionId, request);
}
