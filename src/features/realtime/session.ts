"use client";

import {
  RealtimeAgent,
  RealtimeSession,
  type RealtimeItem,
} from "@openai/agents/realtime";
import { z } from "zod";
import type { AgentState } from "@/features/display/protocol";
import type { CanvasState } from "@/features/workspace/schema";
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
  transport: { sendEvent(event: { type: string }): void };
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
  fetcher?: Fetcher;
  createSession?: SessionFactory;
}

const tokenSchema = z.object({ value: z.string().startsWith("ek_") });

export class ChalkPilotRealtime {
  private readonly options: ChalkPilotRealtimeOptions;
  private readonly fetcher: Fetcher;
  private readonly createSession: SessionFactory;
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
  }

  async connect() {
    this.options.onState?.("thinking");
    const response = await this.fetcher("/api/realtime-token", {
      method: "POST",
    });
    if (!response.ok) {
      const error = await readableError(response);
      this.options.onState?.("error");
      throw new Error(error);
    }
    const { value } = tokenSchema.parse(await response.json());

    const tools = createChalkPilotTools({
      sessionId: this.options.sessionId,
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
        "Inspect the newly attached board image. Add or update one concise canvas section with useful learning context grounded in what is visible, then give one short spoken cue.",
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

  private handleError(error: unknown) {
    this.finishActiveResponse();
    this.options.onState?.("error");
    this.options.onError?.(realtimeErrorMessage(error));
  }
}

function realtimeErrorMessage(error: unknown, depth = 0): string {
  if (depth > 3) return "The voice session failed.";
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (!error || typeof error !== "object") return "The voice session failed.";

  const value = error as { error?: unknown; message?: unknown };
  if (typeof value.message === "string" && value.message.trim()) {
    return value.message;
  }
  if (value.error !== undefined) {
    return realtimeErrorMessage(value.error, depth + 1);
  }
  return "The voice session failed.";
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

async function readableError(response: Response): Promise<string> {
  const parsed = z
    .object({ error: z.string() })
    .safeParse(await response.json().catch(() => null));
  return parsed.success ? parsed.data.error : "Could not start voice.";
}
