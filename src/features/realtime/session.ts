"use client";

import {
  RealtimeAgent,
  RealtimeSession,
  type RealtimeItem,
} from "@openai/agents/realtime";
import { z } from "zod";
import {
  CanvasJobClient,
  type CanvasJobState,
} from "@/features/canvas-worker/client";
import type { CanvasDelegationInput } from "@/features/canvas-worker/schema";
import type { AgentState } from "@/features/display/protocol";
import type { CanvasState } from "@/features/workspace/schema";
import { readableRealtimeTokenError, realtimeErrorMessage } from "./errors";
import { chalkPilotInstructions } from "./instructions";
import { createChalkPilotTools, type BoardInspectionStatus } from "./tools";

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export interface BoardImageSource {
  hasMaterialChange(): boolean;
  getLatestImage(): string | null;
  markSent(): void;
}

export interface RealtimeSessionPort {
  transport: {
    sendEvent(event: { type: string; [key: string]: unknown }): void;
  };
  on(event: string, listener: (value?: unknown) => void): void;
  connect(options: { apiKey: string; model: string }): Promise<void>;
  addImage(image: string, options?: { triggerResponse?: boolean }): void;
  sendMessage(message: string): void;
  mute(muted: boolean): void;
  close(): void;
}

type ToolSet = ReturnType<typeof createChalkPilotTools>;
type SessionFactory = (tools: ToolSet) => RealtimeSessionPort;

interface ChalkPilotRealtimeOptions {
  sessionId: string;
  board: BoardImageSource;
  onCanvasChanged: (canvas: CanvasState) => void;
  onState?: (state: AgentState) => void;
  onError?: (message: string) => void;
  onTranscript?: (history: RealtimeItem[]) => void;
  onBoardSent?: () => void;
  onCanvasJobState?: (state: CanvasJobState) => void;
  onCanvasJobError?: (message: string) => void;
  fetcher?: Fetcher;
  createSession?: SessionFactory;
  createJobId?: () => string;
}

export type { CanvasJobState } from "@/features/canvas-worker/client";

const tokenSchema = z.object({ value: z.string().startsWith("ek_") });

export class ChalkPilotRealtime {
  private readonly options: ChalkPilotRealtimeOptions;
  private readonly fetcher: Fetcher;
  private readonly createSession: SessionFactory;
  private readonly canvasJobs: CanvasJobClient;
  private session: RealtimeSessionPort | null = null;
  private pending = Promise.resolve();
  private turnNumber = 0;
  private responseActive = false;
  private responseWaiters: Array<() => void> = [];

  constructor(options: ChalkPilotRealtimeOptions) {
    this.options = options;
    this.fetcher =
      options.fetcher ?? ((input, init) => globalThis.fetch(input, init));
    this.createSession = options.createSession ?? createOpenAiSession;
    this.canvasJobs = new CanvasJobClient({
      sessionId: options.sessionId,
      fetcher: this.fetcher,
      getBoardImage: () => options.board.getLatestImage(),
      onCanvasChanged: options.onCanvasChanged,
      onState: options.onCanvasJobState,
      onError: options.onCanvasJobError,
      onCompleted: (jobId, summary) =>
        this.noteCanvasCompletion(jobId, summary),
      createJobId: options.createJobId,
    });
  }

  async connect() {
    this.options.onState?.("thinking");
    const response = await this.fetcher("/api/realtime-token", {
      method: "POST",
    });
    if (!response.ok) {
      const error = await readableRealtimeTokenError(response);
      this.options.onState?.("error");
      throw new Error(error);
    }
    const { value } = tokenSchema.parse(await response.json());

    const tools = createChalkPilotTools({
      sessionId: this.options.sessionId,
      delegateCanvas: (input) => this.delegateCanvasTask(input),
      fetcher: this.fetcher,
      inspectBoard: () => this.attachBoard(false),
      getEvidenceId: () => `turn-${Math.max(this.turnNumber, 1)}`,
      onCanvasChanged: this.options.onCanvasChanged,
    });
    this.session = this.createSession(tools);
    this.bindEvents(this.session);
    await this.session.connect({
      apiKey: value,
      model: "gpt-realtime-2.1",
    });
    this.options.onState?.("listening");
  }

  async inspectBoardNow(): Promise<BoardInspectionStatus> {
    await this.waitForActiveResponse();
    const status = await this.attachBoard(false);
    if (status === "sent") {
      this.responseActive = true;
      this.requireSession().sendMessage(
        "Inspect the newly attached board image. Delegate one concise canvas task with useful learning context grounded in what is visible, then give one short spoken cue.",
      );
    }
    return status;
  }

  pause(paused: boolean) {
    this.requireSession().mute(paused);
    this.options.onState?.(paused ? "paused" : "listening");
  }

  close() {
    this.session?.close();
    this.session = null;
    this.finishActiveResponse();
    this.options.onState?.("idle");
  }

  whenIdle() {
    return this.pending;
  }

  whenCanvasJobsIdle() {
    return this.canvasJobs.whenIdle();
  }

  delegateCanvasTask(input: CanvasDelegationInput) {
    return this.canvasJobs.delegate(input);
  }

  private bindEvents(session: RealtimeSessionPort) {
    session.on("transport_event", (rawEvent) => {
      const event = rawEvent as { type?: string } | undefined;
      if (event?.type === "input_audio_buffer.speech_started") {
        this.options.onState?.("listening");
      }
      if (event?.type === "input_audio_buffer.speech_stopped") {
        this.turnNumber += 1;
        this.options.onState?.("thinking");
        this.pending = this.pending
          .then(() => this.finishSpokenTurn())
          .catch((error: unknown) => this.handleError(error));
      }
      if (event?.type === "response.created") {
        this.responseActive = true;
      }
      if (event?.type === "response.done") {
        this.finishActiveResponse();
      }
    });
    session.on("agent_start", () => this.options.onState?.("thinking"));
    session.on("audio_start", () => this.options.onState?.("speaking"));
    session.on("audio_stopped", () => this.options.onState?.("listening"));
    session.on("history_updated", (history) =>
      this.options.onTranscript?.(history as RealtimeItem[]),
    );
    session.on("error", (error) => this.handleError(error));
  }

  private async finishSpokenTurn() {
    await this.waitForActiveResponse();
    await this.attachBoard(true);
    this.responseActive = true;
    this.requireSession().transport.sendEvent({ type: "response.create" });
  }

  private waitForActiveResponse() {
    if (!this.responseActive) return Promise.resolve();
    return new Promise<void>((resolve) => this.responseWaiters.push(resolve));
  }

  private finishActiveResponse() {
    this.responseActive = false;
    const waiters = this.responseWaiters.splice(0);
    waiters.forEach((resolve) => resolve());
  }

  private async attachBoard(
    onlyWhenChanged: boolean,
  ): Promise<BoardInspectionStatus> {
    if (onlyWhenChanged && !this.options.board.hasMaterialChange()) {
      return "unchanged";
    }
    const image = this.options.board.getLatestImage();
    if (!image) {
      return "unavailable";
    }
    this.requireSession().addImage(image, { triggerResponse: false });
    this.options.board.markSent();
    this.options.onBoardSent?.();
    return "sent";
  }

  private requireSession() {
    if (!this.session) {
      throw new Error("The voice session is not connected.");
    }
    return this.session;
  }

  private noteCanvasCompletion(jobId: string, summary: string) {
    this.session?.transport.sendEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              `Canvas job ${jobId} completed: ${summary} ` +
              "Do not interrupt; acknowledge it only when useful.",
          },
        ],
      },
    });
  }

  private handleError(error: unknown) {
    this.finishActiveResponse();
    this.options.onState?.("error");
    this.options.onError?.(realtimeErrorMessage(error));
  }
}

function createOpenAiSession(tools: ToolSet): RealtimeSessionPort {
  const agent = new RealtimeAgent({
    name: "ChalkPilot",
    voice: "marin",
    instructions: chalkPilotInstructions,
    tools,
  });
  return new RealtimeSession(agent, {
    model: "gpt-realtime-2.1",
    transport: "webrtc",
    config: {
      outputModalities: ["audio"],
      audio: {
        input: {
          noiseReduction: { type: "far_field" },
          transcription: { model: "gpt-4o-mini-transcribe" },
          turnDetection: {
            type: "semantic_vad",
            eagerness: "medium",
            createResponse: false,
            interruptResponse: true,
          },
        },
        output: { voice: "marin" },
      },
    },
  }) as unknown as RealtimeSessionPort;
}
