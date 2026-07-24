import { createWorkspaceApi } from "@/features/workspace/api";
import { workspaceRepository } from "@/features/workspace/default-repository";
import { studyPackRepository } from "@/features/study-pack/default-repository";
import { StudyPackNotFoundError } from "@/features/study-pack/repository";

export const runtime = "nodejs";

const api = createWorkspaceApi(workspaceRepository, {
  studyPackExists: async (packId) => {
    try {
      await studyPackRepository.readPack(packId);
      return true;
    } catch (error) {
      if (error instanceof StudyPackNotFoundError) return false;
      throw error;
    }
  },
});

export async function POST(request: Request) {
  return api.createSession(request);
}
