import type { CanvasSectionInput } from "@/features/workspace/schema";
import type { StudyEvidence } from "@/features/study-pack/schema";
import type { CanvasWorkerActions } from "./actions";
import { projectCanvasSnapshot } from "./canvas-snapshot";

export function createCanvasJobActions(
  actions: CanvasWorkerActions,
  evidence: StudyEvidence[] = [],
) {
  let upsertedSectionId: string | undefined;
  let focused = false;

  return {
    async readCanvas() {
      return projectCanvasSnapshot(await actions.readCanvas());
    },

    async upsertSection(section: CanvasSectionInput) {
      if (upsertedSectionId !== undefined) {
        throw new Error("A canvas job can upsert one section.");
      }
      validateCitations(section, evidence);
      const result = await actions.upsertSection(section);
      upsertedSectionId = result.sectionId;
      return result;
    },

    async focusSection(input: { sectionId: string }) {
      if (upsertedSectionId === undefined) {
        throw new Error("Upsert a section before focusing.");
      }
      if (input.sectionId !== upsertedSectionId) {
        throw new Error("Focus the upserted section.");
      }
      const result = await actions.focusSection(input);
      focused = true;
      return result;
    },

    assertComplete() {
      if (upsertedSectionId === undefined || !focused) {
        throw new Error("Canvas job must upsert and focus one section.");
      }
    },
  };
}

function validateCitations(
  section: CanvasSectionInput,
  evidence: StudyEvidence[],
) {
  const citations = section.citations ?? [];
  if (evidence.length && !citations.length) {
    throw new Error("Grounded canvas work requires a source citation.");
  }
  if (!evidence.length && citations.length) {
    throw new Error("Canvas citations require resolved study evidence.");
  }
  const byId = new Map(evidence.map((item) => [item.id, item]));
  for (const citation of citations) {
    const item = byId.get(citation.chunkId);
    if (
      !item ||
      item.sourceTitle !== citation.sourceTitle ||
      item.locator !== citation.locator
    ) {
      throw new Error(
        "Canvas citation does not match resolved study evidence.",
      );
    }
  }
}
