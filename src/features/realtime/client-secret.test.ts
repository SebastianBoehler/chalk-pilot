// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { createRealtimeClientSecret } from "./client-secret";

describe("createRealtimeClientSecret", () => {
  it("requests a short-lived secret for the ChalkPilot voice session", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ value: "ek_test_secret", expires_at: 1_800_000_000 }),
    );

    await expect(
      createRealtimeClientSecret("server-key", fetcher),
    ).resolves.toBe("ek_test_secret");

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/client_secrets",
      expect.objectContaining({
        method: "POST",
        headers: {
          authorization: "Bearer server-key",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model: "gpt-realtime-mini",
            audio: { output: { voice: "marin" } },
          },
        }),
      }),
    );
  });

  it("does not expose upstream details when secret creation fails", async () => {
    const fetcher = vi.fn(
      async () => new Response("sensitive", { status: 401 }),
    );

    await expect(
      createRealtimeClientSecret("server-key", fetcher),
    ).rejects.toThrow("Could not start the voice session.");
  });
});
