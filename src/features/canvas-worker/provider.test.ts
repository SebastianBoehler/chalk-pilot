// @vitest-environment node

import { describe, expect, it } from "vitest";
import { resolveCanvasProvider } from "./provider";

describe("canvas worker provider", () => {
  it("defaults to the fast OpenAI canvas model", () => {
    expect(
      resolveCanvasProvider({ OPENAI_API_KEY: "openai-key" }),
    ).toMatchObject({
      provider: "openai",
      model: "gpt-5-mini",
      apiKey: "openai-key",
    });
  });

  it("selects an explicit OpenRouter model", () => {
    expect(
      resolveCanvasProvider({
        CANVAS_AGENT_PROVIDER: "openrouter",
        CANVAS_AGENT_MODEL: "openai/gpt-5-mini",
        OPENROUTER_API_KEY: "openrouter-key",
      }),
    ).toEqual({
      provider: "openrouter",
      model: "openai/gpt-5-mini",
      apiKey: "openrouter-key",
    });
  });

  it("rejects a provider without its required credential", () => {
    expect(() =>
      resolveCanvasProvider({
        CANVAS_AGENT_PROVIDER: "openrouter",
        CANVAS_AGENT_MODEL: "openai/gpt-5-mini",
      }),
    ).toThrow("OPENROUTER_API_KEY");
  });

  it("rejects unsupported providers instead of silently falling back", () => {
    expect(() =>
      resolveCanvasProvider({
        CANVAS_AGENT_PROVIDER: "langchain",
        OPENAI_API_KEY: "openai-key",
      }),
    ).toThrow("Unsupported canvas agent provider");
  });
});
