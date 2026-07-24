import { join } from "node:path";
import { createStudyPackRepository } from "./repository";

export const studyPackRepository = createStudyPackRepository(
  join(process.cwd(), ".chalkpilot"),
);
