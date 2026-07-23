import { z } from "zod";

export function realtimeErrorMessage(error: unknown, depth = 0): string {
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

export async function readableRealtimeTokenError(response: Response) {
  const parsed = z
    .object({ error: z.string() })
    .safeParse(await response.json().catch(() => null));
  return parsed.success ? parsed.data.error : "Could not start voice.";
}
