import type { RealtimeSessionPort } from "./session";

export function sendCanvasCompletion(
  session: RealtimeSessionPort | null,
  jobId: string,
  summary: string,
) {
  session?.transport.sendEvent({
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
