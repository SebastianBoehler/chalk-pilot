import { recordingApi } from "@/features/recording/default-repository";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string; track: string }> },
) {
  const { sessionId, track } = await context.params;
  return recordingApi.interruptRecording(sessionId, track, request);
}
