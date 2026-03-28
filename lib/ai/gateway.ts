import { gateway } from "ai";

import type { SimulationMode } from "@/lib/sim/types";

const DEFAULT_MODEL = "openai/gpt-5-mini";

export interface GatewayContext {
  simulationId: string;
  scenarioKey: string;
  mode: SimulationMode;
  fallbackModels?: string[];
}

export function getDefaultModel(): string {
  return DEFAULT_MODEL;
}

export function resolveGatewayModel(modelId: string) {
  return gateway(modelId || DEFAULT_MODEL);
}

export function getGatewayProviderOptions(context: GatewayContext) {
  return {
    gateway: {
      user: context.simulationId,
      tags: ["simulation", `scenario:${context.scenarioKey}`, `mode:${context.mode}`],
      models: context.fallbackModels ?? [],
    },
  };
}

export function getGatewayRuntimeSummary() {
  return {
    usingApiKey: Boolean(process.env.AI_GATEWAY_API_KEY),
    usingOidcFallback: !process.env.AI_GATEWAY_API_KEY,
  };
}
