import { createStudyPackApi } from "@/features/study-pack/api";
import { studyPackRepository } from "@/features/study-pack/default-repository";

export const runtime = "nodejs";

const api = createStudyPackApi(studyPackRepository);

export function GET() {
  return api.list();
}

export function POST(request: Request) {
  return api.create(request);
}
