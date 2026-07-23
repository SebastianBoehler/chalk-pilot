import { join } from "node:path";
import { createWorkspaceRepository } from "./repository";

export const workspaceRepository = createWorkspaceRepository(
  join(process.cwd(), ".chalkpilot"),
);
