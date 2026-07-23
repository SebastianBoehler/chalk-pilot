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
  canvasSectionMetadataSchema,
  canvasSectionSchema,
  hasSectionContent,
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

const EMPTY_CANVAS: CanvasState = {
  version: 1,
  focusId: null,
  order: [],
  sections: {},
};

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
        if (
          ["chart", "comparison", "sequence", "checkpoint"].includes(
            metadata.kind,
          )
        ) {
          throw new Error("Structured canvas sections are not available yet");
        }
        const content = await readFile(
          join(paths.sectionsDirectory, `${id}.md`),
          "utf8",
        );
        sections[id] = canvasSectionSchema.parse({
          ...metadata,
          content,
        });
      }),
    );
    return { ...stored, sections };
  }

  async function writeCanvasState(sessionId: string, canvas: CanvasState) {
    const paths = getSessionPaths(root, sessionId);
    const metadata = {
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
    };
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

  async function appendSection(sessionId: string, raw: CanvasSectionInput) {
    const input = canvasSectionInputSchema.parse(raw);
    if (!hasSectionContent(input)) {
      throw new Error("Structured canvas sections are not available yet");
    }
    return queue(sessionId, async () => {
      const canvas = await readCanvas(sessionId);
      if (canvas.sections[input.id]) {
        throw new Error(`Canvas section ${input.id} already exists`);
      }
      const now = new Date().toISOString();
      const section = { ...input, createdAt: now, updatedAt: now };
      const next = {
        ...canvas,
        order: [...canvas.order, input.id],
        sections: { ...canvas.sections, [input.id]: section },
      };
      const paths = getSessionPaths(root, sessionId);
      await atomicWrite(
        join(paths.sectionsDirectory, `${input.id}.md`),
        input.content,
      );
      await writeCanvasState(sessionId, next);
      return next;
    });
  }

  async function updateSection(
    sessionId: string,
    input: { id: string; title?: string; content?: string },
  ) {
    return queue(sessionId, async () => {
      const canvas = await readCanvas(sessionId);
      const current = canvas.sections[input.id];
      if (!current) throw new Error(`Unknown canvas section: ${input.id}`);
      if (!hasSectionContent(current)) {
        throw new Error("Structured canvas sections are not available yet");
      }
      const parsed = canvasSectionInputSchema.parse({
        id: current.id,
        kind: current.kind,
        title: input.title ?? current.title,
        content: input.content ?? current.content,
      });
      if (!hasSectionContent(parsed)) {
        throw new Error("Structured canvas sections are not available yet");
      }
      const section = {
        ...parsed,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      };
      const next = {
        ...canvas,
        sections: { ...canvas.sections, [input.id]: section },
      };
      const paths = getSessionPaths(root, sessionId);
      await atomicWrite(
        join(paths.sectionsDirectory, `${input.id}.md`),
        section.content,
      );
      await writeCanvasState(sessionId, next);
      return next;
    });
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
