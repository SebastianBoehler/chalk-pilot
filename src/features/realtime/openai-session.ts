import {
  OpenAIRealtimeWebRTC,
  RealtimeAgent,
  RealtimeSession,
} from "@openai/agents/realtime";
import type { RealtimeSessionPort } from "./session";
import { chalkPilotInstructions } from "./instructions";
import { createMicrophoneTransport } from "./microphone-transport";
import { CHALKPILOT_REALTIME_MODEL } from "./model";
import { type createChalkPilotTools } from "./tools";

interface OpenAiSessionFactories {
  createTransport: (microphone: MediaStream) => OpenAIRealtimeWebRTC;
  createSession: (
    agent: RealtimeAgent,
    transport: OpenAIRealtimeWebRTC,
  ) => RealtimeSessionPort;
}

const defaultFactories: OpenAiSessionFactories = {
  createTransport: createMicrophoneTransport,
  createSession: (agent, transport) =>
    new RealtimeSession(agent, {
      model: CHALKPILOT_REALTIME_MODEL,
      transport,
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
    }) as unknown as RealtimeSessionPort,
};

export function createOpenAiSession(
  tools: ReturnType<typeof createChalkPilotTools>,
  microphone: MediaStream,
  factories: OpenAiSessionFactories = defaultFactories,
): RealtimeSessionPort {
  const agent = new RealtimeAgent({
    name: "ChalkPilot",
    voice: "marin",
    instructions: chalkPilotInstructions,
    tools,
  });
  const transport = factories.createTransport(microphone);
  try {
    return factories.createSession(agent, transport);
  } catch (error) {
    transport.close();
    throw error;
  }
}
