import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

type CanvasProvider = "openai" | "openrouter";

export interface CanvasProviderConfig {
  provider: CanvasProvider;
  model: string;
  apiKey: string;
}

export interface CanvasProviderEnvironment {
  CANVAS_AGENT_PROVIDER?: string;
  CANVAS_AGENT_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

export class CanvasProviderConfigurationError extends Error {}

export function resolveCanvasProvider(
  env: CanvasProviderEnvironment,
): CanvasProviderConfig {
  const provider = (env.CANVAS_AGENT_PROVIDER?.trim() ||
    "openai") as CanvasProvider;
  if (provider === "openai") {
    return {
      provider,
      model: env.CANVAS_AGENT_MODEL?.trim() || "gpt-5-mini",
      apiKey: required(env.OPENAI_API_KEY, "OPENAI_API_KEY"),
    };
  }
  if (provider === "openrouter") {
    return {
      provider,
      model: required(env.CANVAS_AGENT_MODEL, "CANVAS_AGENT_MODEL"),
      apiKey: required(env.OPENROUTER_API_KEY, "OPENROUTER_API_KEY"),
    };
  }
  throw new CanvasProviderConfigurationError(
    `Unsupported canvas agent provider: ${provider}`,
  );
}

export function createCanvasModel(
  env: CanvasProviderEnvironment = process.env as CanvasProviderEnvironment,
): LanguageModel {
  const config = resolveCanvasProvider(env);
  if (config.provider === "openai") {
    return createOpenAI({ apiKey: config.apiKey })(config.model);
  }
  return createOpenRouter({
    apiKey: config.apiKey,
    appName: "ChalkPilot",
    appUrl: "https://github.com/SebastianBoehler/chalk-pilot",
  })(config.model, {
    provider: {
      sort: "throughput",
      require_parameters: true,
      data_collection: "deny",
      zdr: true,
    },
  });
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new CanvasProviderConfigurationError(
      `${name} is required for the canvas agent.`,
    );
  }
  return normalized;
}
