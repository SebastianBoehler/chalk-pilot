import { recordingApi } from "@/features/recording/default-repository";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  return recordingApi.finalizeRecording(sessionId, request);
}
