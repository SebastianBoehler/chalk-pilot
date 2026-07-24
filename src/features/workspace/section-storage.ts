import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  canvasSectionMetadataSchema,
  canvasSectionSchema,
  hasSectionContent,
  storedCanvasStateSchema,
  type CanvasSection,
  type CanvasSectionInput,
  type CanvasSectionMetadata,
  type CanvasState,
  type StoredCanvasState,
} from "./schema";

type SectionPayload = CanvasSectionInput | CanvasSection;

export function payloadFileName(section: SectionPayload): string {
  return `${section.id}.${payloadExtension(section.kind)}`;
}

export function serializeSectionPayload(section: SectionPayload): string {
  return hasSectionContent(section)
    ? section.content
    : `${JSON.stringify(section.data, null, 2)}\n`;
}

export async function readSection(
  directory: string,
  metadata: CanvasSectionMetadata,
): Promise<CanvasSection> {
  const payload = await readFile(
    join(directory, `${metadata.id}.${payloadExtension(metadata.kind)}`),
    "utf8",
  );
  const restored = hasContentKind(metadata.kind)
    ? { ...metadata, content: payload }
    : { ...metadata, data: JSON.parse(payload) };

  return canvasSectionSchema.parse(restored);
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

function payloadExtension(kind: CanvasSection["kind"]): "md" | "json" {
  return hasContentKind(kind) ? "md" : "json";
}

function hasContentKind(kind: CanvasSection["kind"]): boolean {
  return !["chart", "comparison", "flow", "sequence", "checkpoint"].includes(
    kind,
  );
}
