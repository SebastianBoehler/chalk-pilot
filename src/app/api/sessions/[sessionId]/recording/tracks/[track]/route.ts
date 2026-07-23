import { recordingApi } from "@/features/recording/default-repository";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ sessionId: string; track: string }> },
) {
  const { sessionId, track } = await context.params;
  return recordingApi.streamTrack(sessionId, track, request);
}
