import { createStudyPackApi } from "@/features/study-pack/api";
import { studyPackRepository } from "@/features/study-pack/default-repository";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ packId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { packId } = await context.params;
  return createStudyPackApi(studyPackRepository).upload(packId, request);
}
