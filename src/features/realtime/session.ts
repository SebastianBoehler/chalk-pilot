"use client";

import { type RealtimeItem } from "@openai/agents/realtime";
import { z } from "zod";
import {
  CanvasJobClient,
  type CanvasJobState,
} from "@/features/canvas-worker/client";
import type { CanvasNavigation } from "@/features/canvas-navigation/schema";
import type { CanvasDelegationInput } from "@/features/canvas-worker/schema";
import type { AgentState } from "@/features/display/protocol";
import type { CanvasState } from "@/features/workspace/schema";
import { RealtimeConnection } from "./connection";
import { readableRealtimeTokenError, realtimeErrorMessage } from "./errors";
import { CHALKPILOT_REALTIME_MODEL } from "./model";
import { createOpenAiSession } from "./openai-session";
import { sendCanvasCompletion } from "./canvas-completion";
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
type SessionFactory = (
  tools: ToolSet,
  microphone: MediaStream,
) => RealtimeSessionPort;

export interface ChalkPilotRealtimeOptions {
  sessionId: string;
  board: BoardImageSource;
  microphone: MediaStream;
  onCanvasChanged: (canvas: CanvasState) => void;
  getCanvas: () => CanvasState;
  onNavigation: (navigation: CanvasNavigation, canvas: CanvasState) => void;
  onState?: (state: AgentState) => void;
  onError?: (message: string) => void;
  onTranscript?: (history: RealtimeItem[]) => void;
  onCueStart?: (speaker: "user" | "assistant", atMs: number) => void;
  onCueEnd?: (speaker: "user" | "assistant", atMs: number) => void;
  onBoardSent?: () => void;
  onCanvasJobState?: (state: CanvasJobState) => void;
  onCanvasJobError?: (message: string) => void;
  fetcher?: Fetcher;
  createSession?: SessionFactory;
  createJobId?: () => string;
  now?: () => number;
}

export type { CanvasJobState } from "@/features/canvas-worker/client";

const tokenSchema = z.object({ value: z.string().startsWith("ek_") });

export class ChalkPilotRealtime {
  private readonly options: ChalkPilotRealtimeOptions;
  private readonly fetcher: Fetcher;
  private readonly createSession: SessionFactory;
  private readonly canvasJobs: CanvasJobClient;
  private readonly connection: RealtimeConnection<RealtimeSessionPort>;
  private pending = Promise.resolve();
  private turnNumber = 0;
  private responseActive = false;
  private assistantAudioActive = false;
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
      onNavigation: options.onNavigation,
      onState: options.onCanvasJobState,
      onError: options.onCanvasJobError,
      onCompleted: (jobId, summary) =>
        sendCanvasCompletion(this.connection.currentSession, jobId, summary),
      createJobId: options.createJobId,
    });
    this.connection = new RealtimeConnection({
      model: CHALKPILOT_REALTIME_MODEL,
      loadToken: (signal) => this.loadToken(signal),
      createSession: () => this.createRealtimeSession(),
      onSession: (session) => this.bindEvents(session),
      onConnecting: () => this.options.onState?.("thinking"),
      onConnected: () => this.options.onState?.("listening"),
      onConnectionError: () => this.options.onState?.("error"),
    });
  }

  connect(): Promise<void> {
    return this.connection.connect();
  }

  private async loadToken(signal: AbortSignal) {
    const response = await this.fetcher("/api/realtime-token", {
      method: "POST",
      signal,
    });
    if (!response.ok) {
      const error = await readableRealtimeTokenError(response);
      throw new Error(error);
    }
    const { value } = tokenSchema.parse(await response.json());
    return value;
  }

  private createRealtimeSession() {
    const tools = createChalkPilotTools({
      sessionId: this.options.sessionId,
      delegateCanvas: (input) => this.delegateCanvasTask(input),
      fetcher: this.fetcher,
      inspectBoard: () => this.attachBoard(false),
      getEvidenceId: () => `turn-${Math.max(this.turnNumber, 1)}`,
      getCanvas: this.options.getCanvas,
      onCanvasChanged: this.options.onCanvasChanged,
      onNavigation: this.options.onNavigation,
    });
    return this.createSession(tools, this.options.microphone);
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
    this.connection.close();
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
    this.assistantAudioActive = false;
    session.on("transport_event", (rawEvent) => {
      if (!this.connection.isCurrent(session)) return;
      const event = rawEvent as { type?: string } | undefined;
      if (event?.type === "input_audio_buffer.speech_started") {
        this.options.onCueStart?.("user", this.now());
        this.options.onState?.("listening");
      }
      if (event?.type === "input_audio_buffer.speech_stopped") {
        this.options.onCueEnd?.("user", this.now());
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
    session.on("agent_start", () => {
      if (this.connection.isCurrent(session))
        this.options.onState?.("thinking");
    });
    session.on("audio_start", () => {
      if (this.connection.isCurrent(session)) {
        if (!this.assistantAudioActive) {
          this.assistantAudioActive = true;
          this.options.onCueStart?.("assistant", this.now());
        }
        this.options.onState?.("speaking");
      }
    });
    session.on("audio_stopped", () => this.finishAssistantAudio(session));
    session.on("audio_interrupted", () => this.finishAssistantAudio(session));
    session.on("history_updated", (history) => {
      if (this.connection.isCurrent(session))
        this.options.onTranscript?.(history as RealtimeItem[]);
    });
    session.on("error", (error) => {
      if (this.connection.isCurrent(session)) this.handleError(error);
    });
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
    const session = this.connection.currentSession;
    if (!session) {
      throw new Error("The voice session is not connected.");
    }
    return session;
  }

  private handleError(error: unknown) {
    this.finishActiveResponse();
    this.options.onState?.("error");
    this.options.onError?.(realtimeErrorMessage(error));
  }

  private finishAssistantAudio(session: RealtimeSessionPort) {
    if (!this.connection.isCurrent(session)) return;
    if (this.assistantAudioActive) {
      this.assistantAudioActive = false;
      this.options.onCueEnd?.("assistant", this.now());
    }
    this.options.onState?.("listening");
  }

  private now() {
    return (this.options.now ?? (() => performance.now()))();
  }
}
