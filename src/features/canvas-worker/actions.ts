import {
  canvasSectionInputSchema,
  identifierSchema,
  type CanvasSectionInput,
} from "@/features/workspace/schema";
import type { WorkspaceRepository } from "@/features/workspace/repository";

export function createCanvasWorkerActions(
  repository: WorkspaceRepository,
  sessionId: string,
) {
  return {
    async readCanvas() {
      return repository.readCanvas(sessionId);
    },

    async upsertSection(raw: CanvasSectionInput) {
      const section = canvasSectionInputSchema.parse(raw);
      const canvas = await repository.readCanvas(sessionId);
      if (!canvas.sections[section.id]) {
        await repository.appendSection(sessionId, section);
      } else {
        await repository.updateSection(sessionId, section);
      }
      return { sectionId: section.id };
    },

    async focusSection(input: { sectionId: string }) {
      const sectionId = identifierSchema.parse(input.sectionId);
      await repository.setFocus(sessionId, sectionId);
      return { sectionId };
    },
  };
}

export type CanvasWorkerActions = ReturnType<typeof createCanvasWorkerActions>;
