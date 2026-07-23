import { createWorkspaceApi } from "@/features/workspace/api";
import { workspaceRepository } from "@/features/workspace/default-repository";

export const runtime = "nodejs";

export async function POST() {
  return createWorkspaceApi(workspaceRepository).createSession();
}
