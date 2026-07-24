"use client";

import { z } from "zod";
import {
  createCanvasNavigation,
  type CanvasNavigation,
} from "@/features/canvas-navigation/schema";
import type { CanvasState } from "@/features/workspace/schema";
import {
  canvasJobRequestSchema,
  canvasJobResultSchema,
  type CanvasDelegationInput,
  type CanvasJobRequest,
} from "./schema";

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type CanvasJobState = "idle" | "building" | "complete" | "error";

interface CanvasJobClientOptions {
  sessionId: string;
  fetcher: Fetcher;
  getBoardImage: () => string | null;
  onCanvasChanged: (canvas: CanvasState) => void;
  onNavigation: (navigation: CanvasNavigation) => void;
  onState?: (state: CanvasJobState) => void;
  onError?: (message: string) => void;
  onCompleted: (jobId: string, summary: string) => void;
  createJobId?: () => string;
}

export class CanvasJobClient {
  private readonly jobs = new Set<Promise<void>>();
  private readonly createJobId: () => string;

  constructor(private readonly options: CanvasJobClientOptions) {
    this.createJobId =
      options.createJobId ?? (() => globalThis.crypto.randomUUID());
  }

  delegate(input: CanvasDelegationInput) {
    const request = canvasJobRequestSchema.parse({
      ...input,
      jobId: this.createJobId(),
      boardImage: this.options.getBoardImage() ?? undefined,
    });
    this.options.onState?.("building");
    const job = this.run(request);
    this.jobs.add(job);
    void job.finally(() => this.jobs.delete(job));
    return { jobId: request.jobId };
  }

  whenIdle() {
    return Promise.all([...this.jobs]).then(() => undefined);
  }

  private async run(request: CanvasJobRequest) {
    try {
      const response = await this.options.fetcher(
        `/api/sessions/${this.options.sessionId}/canvas-jobs`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
        },
      );
      if (!response.ok) throw new Error(await canvasJobError(response));
      const result = canvasJobResultSchema.parse(await response.json());
      if (!result.canvas.focusId) {
        throw new Error("Canvas worker result omitted its focus target.");
      }
      this.options.onCanvasChanged(result.canvas);
      this.options.onNavigation(
        createCanvasNavigation({
          kind: "focus",
          targetId: result.canvas.focusId,
        }),
      );
      this.options.onCompleted(result.jobId, result.summary);
      this.options.onState?.("complete");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The canvas worker failed.";
      this.options.onState?.("error");
      this.options.onError?.(message);
    }
  }
}

async function canvasJobError(response: Response): Promise<string> {
  const parsed = z
    .object({ error: z.string().trim().min(1) })
    .safeParse(await response.json().catch(() => null));
  return parsed.success
    ? parsed.data.error
    : "The canvas worker could not complete that artifact.";
}
