import type { TranscriptLine } from "@/features/session/transcript";
import type { CanvasNavigation } from "@/features/canvas-navigation/schema";
import type { CanvasState } from "@/features/workspace/schema";
import type { RecordingTimelineEvent } from "./schema";

type Speaker = TranscriptLine["role"];
type AppendTimeline = (event: RecordingTimelineEvent) => Promise<void>;

interface Cue {
  speaker: Speaker;
  startMs: number;
  endMs?: number;
  persisted: boolean;
}

export class RecordingTimeline {
  private epoch: number | null = null;
  private readonly cues: Cue[] = [];
  private readonly pendingText: Record<Speaker, TranscriptLine[]> = {
    user: [],
    assistant: [],
  };
  private readonly attached = new Set<string>();
  private canvasFingerprint: string | null = null;
  private closing = false;
  private sealed = false;
  private writes = Promise.resolve();

  constructor(private readonly append: AppendTimeline) {}

  start(epoch: number) {
    if (this.epoch !== null) {
      throw new Error("The recording timeline is already active.");
    }
    this.epoch = epoch;
    this.closing = false;
    this.sealed = false;
  }

  noteCueStart(speaker: Speaker, atMs: number) {
    if (this.epoch === null || this.closing) return;
    this.cues.push({
      speaker,
      startMs: this.offset(atMs),
      persisted: false,
    });
  }

  noteCueEnd(speaker: Speaker, atMs: number) {
    if (this.epoch === null || this.closing) return;
    const cue = [...this.cues]
      .reverse()
      .find(
        (candidate) =>
          candidate.speaker === speaker && candidate.endMs === undefined,
      );
    if (!cue) return;
    cue.endMs = Math.max(cue.startMs, this.offset(atMs));
    this.attachPending(speaker);
  }

  closeOpenCues(atMs: number) {
    if (this.epoch === null) return;
    this.closing = true;
    const endMs = this.offset(atMs);
    for (const cue of this.cues) {
      if (cue.endMs === undefined) cue.endMs = Math.max(cue.startMs, endMs);
    }
    this.attachPending("user");
    this.attachPending("assistant");
  }

  attachTranscript(line: TranscriptLine) {
    if (this.epoch === null || this.sealed || this.attached.has(line.sourceId))
      return;
    const cue = this.nextCompletedCue(line.role);
    if (!cue) {
      if (!this.hasPendingCue(line.role)) return;
      this.attached.add(line.sourceId);
      this.pendingText[line.role].push(line);
      return;
    }
    this.attached.add(line.sourceId);
    this.persistTranscript(cue, line);
  }

  noteCanvas(canvas: CanvasState, atMs: number) {
    if (this.epoch === null || this.closing || this.sealed) return;
    const fingerprint = JSON.stringify(canvas);
    if (fingerprint === this.canvasFingerprint) return;
    this.canvasFingerprint = fingerprint;
    this.enqueue({
      type: "canvas",
      offsetMs: this.offset(atMs),
      revision: canvas,
    });
  }

  noteNavigation(navigation: CanvasNavigation, atMs: number) {
    if (this.epoch === null || this.closing || this.sealed) return;
    this.enqueue({
      type: "navigation",
      offsetMs: this.offset(atMs),
      navigation,
    });
  }

  drain() {
    return this.writes;
  }

  seal() {
    this.sealed = true;
  }

  finish() {
    this.epoch = null;
  }

  private attachPending(speaker: Speaker) {
    let cue = this.nextCompletedCue(speaker);
    let line = this.pendingText[speaker].shift();
    while (cue && line) {
      this.persistTranscript(cue, line);
      cue = this.nextCompletedCue(speaker);
      line = this.pendingText[speaker].shift();
    }
    if (line) this.pendingText[speaker].unshift(line);
  }

  private nextCompletedCue(speaker: Speaker) {
    return this.cues.find(
      (cue) =>
        cue.speaker === speaker && cue.endMs !== undefined && !cue.persisted,
    ) as (Cue & { endMs: number }) | undefined;
  }

  private hasPendingCue(speaker: Speaker) {
    return this.cues.some((cue) => cue.speaker === speaker && !cue.persisted);
  }

  private persistTranscript(
    cue: Cue & { endMs: number },
    line: TranscriptLine,
  ) {
    cue.persisted = true;
    this.enqueue({
      type: "transcript",
      speaker: line.role,
      startMs: cue.startMs,
      endMs: cue.endMs,
      text: line.text,
    });
  }

  private enqueue(event: RecordingTimelineEvent) {
    this.writes = this.writes.then(() => this.append(event));
  }

  private offset(atMs: number) {
    return Math.max(0, atMs - this.epoch!);
  }
}
