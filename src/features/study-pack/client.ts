import { studyPackSchema, type StudyPack } from "./schema";

export interface StudyPackClient {
  list(): Promise<StudyPack[]>;
  create(title: string): Promise<StudyPack>;
  read(packId: string): Promise<StudyPack>;
  upload(packId: string, file: File): Promise<StudyPack>;
}

export function createStudyPackClient(
  fetcher: typeof fetch = globalThis.fetch,
): StudyPackClient {
  return {
    async list() {
      const response = await fetcher("/api/study-packs");
      return studyPackSchema.array().parse(await result(response));
    },

    async create(title) {
      const response = await fetcher("/api/study-packs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      return studyPackSchema.parse(await result(response));
    },

    async read(packId) {
      const response = await fetcher(`/api/study-packs/${packId}`);
      return studyPackSchema.parse(await result(response));
    },

    async upload(packId, file) {
      const body = new FormData();
      body.set("file", file);
      const response = await fetcher(`/api/study-packs/${packId}/sources`, {
        method: "POST",
        body,
      });
      const upload = (await result(response)) as { pack?: unknown };
      return studyPackSchema.parse(upload.pack);
    },
  };
}

export const studyPackClient = createStudyPackClient();

async function result(response: Response) {
  const body = (await response.json()) as { error?: unknown };
  if (!response.ok) {
    const message =
      typeof body.error === "string" ? body.error : "Study material failed.";
    throw new Error(message);
  }
  return body;
}
