import { createRealtimeClientSecret } from "@/features/realtime/client-secret";

export const runtime = "nodejs";

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 503 },
    );
  }

  try {
    return Response.json({
      value: await createRealtimeClientSecret(apiKey),
    });
  } catch {
    return Response.json(
      { error: "Could not start the voice session." },
      { status: 502 },
    );
  }
}
