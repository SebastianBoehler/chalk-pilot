import { getRecordingPaths } from "../workspace/paths";
import {
  recordingTimelineEventSchema,
  replayTimelineSchema,
  transcriptTimelineEventSchema,
  type ReplayTimeline,
} from "./schema";
import { readJson } from "./repository-files";

export async function readStoredTimeline(
  root: string,
  sessionId: string,
): Promise<ReplayTimeline> {
  const paths = getRecordingPaths(root, sessionId);
  const transcript = transcriptTimelineEventSchema
    .array()
    .parse(await readJson(paths.transcript));
  const semanticEvents = recordingTimelineEventSchema
    .array()
    .parse(await readJson(paths.canvasEvents));
  return replayTimelineSchema.parse({
    transcript,
    canvasEvents: semanticEvents.filter((event) => event.type === "canvas"),
    navigationEvents: semanticEvents.filter(
      (event) => event.type === "navigation",
    ),
  });
}
