import { recordingApi } from "@/features/recording/default-repository";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  return recordingApi.readManifest(sessionId);
}

export async function POST(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  return recordingApi.createRecording(sessionId);
}
