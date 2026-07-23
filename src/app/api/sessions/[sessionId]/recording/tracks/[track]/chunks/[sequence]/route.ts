import { recordingApi } from "@/features/recording/default-repository";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: {
    params: Promise<{ sessionId: string; track: string; sequence: string }>;
  },
) {
  const { sessionId, track, sequence } = await context.params;
  return recordingApi.appendChunk(sessionId, track, sequence, request);
}
