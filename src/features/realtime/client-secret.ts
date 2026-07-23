import { z } from "zod";
import { CHALKPILOT_REALTIME_MODEL } from "./model";

const clientSecretSchema = z.object({
  value: z.string().startsWith("ek_"),
});

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export async function createRealtimeClientSecret(
  apiKey: string,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const response = await fetcher(
    "https://api.openai.com/v1/realtime/client_secrets",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: CHALKPILOT_REALTIME_MODEL,
          audio: { output: { voice: "marin" } },
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Could not start the voice session.");
  }

  const parsed = clientSecretSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Could not start the voice session.");
  }
  return parsed.data.value;
}
