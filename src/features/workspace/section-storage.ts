import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  canvasSectionSchema,
  canvasSectionMetadataSchema,
  hasSectionContent,
  storedCanvasStateSchema,
  type CanvasSection,
  type CanvasSectionInput,
  type CanvasSectionMetadata,
  type CanvasState,
  type StoredCanvasState,
} from "./schema";

const structuredSectionKinds = new Set<CanvasSection["kind"]>([
  "chart",
  "comparison",
  "sequence",
  "checkpoint",
]);

type TextSection = Extract<
  CanvasSectionInput | CanvasSection,
  { content: string }
>;

export function requireTextSection(
  section: CanvasSectionInput | CanvasSection,
): TextSection {
  if (!hasSectionContent(section)) {
    throw new Error("Structured canvas sections are not available yet");
  }
  return section;
}

export function requireTextSectionKind(kind: CanvasSection["kind"]) {
  if (structuredSectionKinds.has(kind)) {
    throw new Error("Structured canvas sections are not available yet");
  }
}

export function restoreTextSection(
  metadata: CanvasSectionMetadata,
  content: string,
): CanvasSection {
  requireTextSectionKind(metadata.kind);
  return canvasSectionSchema.parse({ ...metadata, content });
}

export async function readTextSection(
  directory: string,
  metadata: CanvasSectionMetadata,
): Promise<CanvasSection> {
  return restoreTextSection(
    metadata,
    await readFile(join(directory, `${metadata.id}.md`), "utf8"),
  );
}

export function projectStoredCanvasState(
  canvas: CanvasState,
): StoredCanvasState {
  return storedCanvasStateSchema.parse({
    ...canvas,
    sections: Object.fromEntries(
      Object.entries(canvas.sections).map(([id, section]) => {
        const { createdAt, kind, title, updatedAt } = section;
        return [
          id,
          canvasSectionMetadataSchema.parse({
            id,
            kind,
            title,
            createdAt,
            updatedAt,
          }),
        ];
      }),
    ),
  });
}
