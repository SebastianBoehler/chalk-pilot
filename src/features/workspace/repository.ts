import {
  appendFile,
  mkdir,
  readFile,
  rename,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { getSessionPaths } from "./paths";
import {
  canvasSectionInputSchema,
  canvasSectionSchema,
  learnerMemoryInputSchema,
  learningEventSchema,
  sessionRecordSchema,
  storedCanvasStateSchema,
  transcriptTurnSchema,
  type CanvasSectionInput,
  type CanvasState,
  type LearnerMemory,
  type LearnerMemoryEntry,
  type LearnerMemoryInput,
  type SessionRecord,
} from "./schema";
import {
  payloadFileName,
  projectStoredCanvasState,
  readSection,
  serializeSectionPayload,
} from "./section-storage";

const EMPTY_CANVAS: CanvasState = {
  version: 1,
  focusId: null,
  order: [],
  sections: {},
};
type SectionMutation = "append" | "update" | "upsert";

export function createWorkspaceRepository(rootDirectory: string) {
  const root = resolve(rootDirectory);
  const queues = new Map<string, Promise<unknown>>();

  async function queue<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = queues.get(key) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    queues.set(key, current);
    try {
      return await current;
    } finally {
      if (queues.get(key) === current) queues.delete(key);
    }
  }

  async function atomicWrite(path: string, content: string) {
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, content, "utf8");
    await rename(temporary, path);
  }

  async function readSession(sessionId: string): Promise<SessionRecord> {
    const paths = getSessionPaths(root, sessionId);
    try {
      return sessionRecordSchema.parse(
        JSON.parse(await readFile(paths.record, "utf8")),
      );
    } catch (error) {
      if (isMissingFile(error))
        throw new Error(`Unknown session: ${sessionId}`);
      throw error;
    }
  }

  async function readCanvas(sessionId: string): Promise<CanvasState> {
    await readSession(sessionId);
    const paths = getSessionPaths(root, sessionId);
    const stored = storedCanvasStateSchema.parse(
      JSON.parse(await readFile(paths.canvasState, "utf8")),
    );
    const sections: CanvasState["sections"] = {};
    await Promise.all(
      stored.order.map(async (id) => {
        const metadata = stored.sections[id];
        if (!metadata)
          throw new Error(`Missing canvas section metadata: ${id}`);
        sections[id] = await readSection(paths.sectionsDirectory, metadata);
      }),
    );
    return { ...stored, sections };
  }

  async function writeCanvasState(sessionId: string, canvas: CanvasState) {
    const paths = getSessionPaths(root, sessionId);
    const metadata = projectStoredCanvasState(canvas);
    await atomicWrite(
      paths.canvasState,
      `${JSON.stringify(metadata, null, 2)}\n`,
    );
  }

  async function createSession(): Promise<SessionRecord> {
    const id = randomUUID();
    const paths = getSessionPaths(root, id);
    const record: SessionRecord = {
      id,
      status: "active",
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    await mkdir(paths.sectionsDirectory, { recursive: true });
    await Promise.all([
      writeFile(paths.record, `${JSON.stringify(record, null, 2)}\n`, "utf8"),
      writeFile(
        paths.canvasState,
        `${JSON.stringify(EMPTY_CANVAS, null, 2)}\n`,
        "utf8",
      ),
      writeFile(paths.transcript, "", "utf8"),
      writeFile(paths.events, "", "utf8"),
    ]);
    return record;
  }

  async function mutateSection(
    sessionId: string,
    raw: CanvasSectionInput,
    mutation: SectionMutation,
  ) {
    const input = canvasSectionInputSchema.parse(raw);
    return queue(sessionId, async () => {
      const canvas = await readCanvas(sessionId);
      const current = canvas.sections[input.id];
      if (mutation === "append" && current) {
        throw new Error(`Canvas section ${input.id} already exists`);
      }
      if (mutation === "update" && !current) {
        throw new Error(`Unknown canvas section: ${input.id}`);
      }
      const now = new Date().toISOString();
      const section = canvasSectionSchema.parse({
        ...input,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      });
      const next = {
        ...canvas,
        order: current ? canvas.order : [...canvas.order, input.id],
        sections: { ...canvas.sections, [input.id]: section },
      };
      const paths = getSessionPaths(root, sessionId);
      await atomicWrite(
        join(paths.sectionsDirectory, payloadFileName(section)),
        serializeSectionPayload(section),
      );
      await writeCanvasState(sessionId, next);
      return next;
    });
  }

  function appendSection(sessionId: string, raw: CanvasSectionInput) {
    return mutateSection(sessionId, raw, "append");
  }

  async function updateSection(sessionId: string, raw: CanvasSectionInput) {
    return mutateSection(sessionId, raw, "update");
  }

  function upsertSection(sessionId: string, raw: CanvasSectionInput) {
    return mutateSection(sessionId, raw, "upsert");
  }

  async function setFocus(sessionId: string, sectionId: string | null) {
    return queue(sessionId, async () => {
      const canvas = await readCanvas(sessionId);
      if (sectionId && !canvas.sections[sectionId]) {
        throw new Error(`Unknown canvas section: ${sectionId}`);
      }
      const next = { ...canvas, focusId: sectionId };
      await writeCanvasState(sessionId, next);
      return next;
    });
  }

  async function appendTranscript(sessionId: string, raw: unknown) {
    const turn = transcriptTurnSchema.parse(raw);
    await queue(sessionId, async () => {
      await readSession(sessionId);
      await appendFile(
        getSessionPaths(root, sessionId).transcript,
        `${JSON.stringify(turn)}\n`,
      );
    });
  }

  async function appendEvent(sessionId: string, raw: unknown) {
    const event = learningEventSchema.parse(raw);
    await queue(sessionId, async () => {
      await readSession(sessionId);
      await appendFile(
        getSessionPaths(root, sessionId).events,
        `${JSON.stringify(event)}\n`,
      );
    });
  }

  async function rememberLearner(
    raw: LearnerMemoryInput,
  ): Promise<LearnerMemory> {
    const input = learnerMemoryInputSchema.parse(raw);
    return queue("learner-memory", async () => {
      const path = join(root, "learner.md");
      const memory = await readMemory(path);
      const entry: LearnerMemoryEntry = {
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      const next = { version: 1 as const, entries: [...memory.entries, entry] };
      await mkdir(root, { recursive: true });
      await atomicWrite(path, renderMemory(next));
      return next;
    });
  }

  return {
    createSession,
    readCanvas,
    appendSection,
    updateSection,
    upsertSection,
    setFocus,
    appendTranscript,
    appendEvent,
    rememberLearner,
  };
}

export type WorkspaceRepository = ReturnType<typeof createWorkspaceRepository>;

async function readMemory(path: string): Promise<LearnerMemory> {
  try {
    return parseMemory(await readFile(path, "utf8"));
  } catch (error) {
    if (isMissingFile(error)) return { version: 1, entries: [] };
    throw error;
  }
}

function renderMemory(memory: LearnerMemory): string {
  const entries = memory.entries.map(
    (entry) =>
      `## ${entry.id}\n- Claim: ${oneLine(entry.claim)}\n- Evidence: ${entry.evidence}\n` +
      `- Scope: ${oneLine(entry.scope)}\n- Confidence: ${entry.confidence}\n` +
      `- Created: ${entry.createdAt}\n`,
  );
  return `# ChalkPilot learner memory\n\n${entries.join("\n")}`;
}

function parseMemory(markdown: string): LearnerMemory {
  const entries = [
    ...markdown.matchAll(/## ([^\n]+)\n([\s\S]*?)(?=\n## |$)/g),
  ].map(([, id, body]) => ({
    id,
    claim: field(body, "Claim"),
    evidence: field(body, "Evidence"),
    scope: field(body, "Scope"),
    confidence: Number(field(body, "Confidence")),
    createdAt: field(body, "Created"),
  }));
  return { version: 1, entries };
}

function field(body: string, name: string): string {
  const match = body.match(new RegExp(`^- ${name}: (.+)$`, "m"));
  if (!match?.[1]) throw new Error(`Invalid learner memory field: ${name}`);
  return match[1];
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
