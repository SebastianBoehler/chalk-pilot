import { tool } from "@openai/agents";
import { z } from "zod";
import {
  studyPackOutlineSchema,
  studyPassageSchema,
  studySearchHitSchema,
  studySearchRequestSchema,
} from "./schema";
import { identifierSchema } from "@/features/workspace/schema";

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

interface StudyPackToolRuntime {
  sessionId: string;
  fetcher?: Fetcher;
}

const passageInputSchema = z.object({ chunkId: identifierSchema });
const searchResponseSchema = z.object({
  results: z.array(studySearchHitSchema).max(5),
});

export function createStudyPackActions(runtime: StudyPackToolRuntime) {
  const fetcher = runtime.fetcher ?? fetch;
  const base = `/api/sessions/${runtime.sessionId}/study-pack`;

  return {
    async outline() {
      return studyPackOutlineSchema
        .nullable()
        .parse(await successfulJson(await fetcher(base)));
    },

    async search(raw: z.input<typeof studySearchRequestSchema>) {
      const input = studySearchRequestSchema.parse(raw);
      return searchResponseSchema.parse(
        await successfulJson(await fetcher(`${base}/search`, jsonPost(input))),
      );
    },

    async passage(raw: z.infer<typeof passageInputSchema>) {
      const { chunkId } = passageInputSchema.parse(raw);
      return studyPassageSchema.parse(
        await successfulJson(
          await fetcher(`${base}/passages/${encodeURIComponent(chunkId)}`),
        ),
      );
    },
  };
}

export function createStudyPackTools(runtime: StudyPackToolRuntime) {
  const actions = createStudyPackActions(runtime);
  return [
    tool({
      name: "get_study_pack_outline",
      description:
        "List the selected study pack and its source locators before choosing what to search.",
      parameters: z.object({}),
      execute: actions.outline,
    }),
    tool({
      name: "search_study_pack",
      description:
        "Search selected course material for a specific concept or phrase. Returns canonical sourceChunkIds and provenance.",
      parameters: studySearchRequestSchema,
      execute: actions.search,
    }),
    tool({
      name: "read_study_passage",
      description:
        "Read one canonical study passage and its immediate neighbors after search.",
      parameters: passageInputSchema,
      execute: actions.passage,
    }),
  ];
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function successfulJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    throw new Error(
      typeof result?.error === "string"
        ? result.error
        : "The selected study material could not be read.",
    );
  }
  return response.json();
}
