import type { AgentRuntime } from "orchajs";

import { getServerEnv } from "@/lib/env";
import { orcha } from "@/orcha";

export class AppConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppConfigurationError";
  }
}

export function getAssistant(): AgentRuntime {
  try {
    getServerEnv();
  } catch (error) {
    throw new AppConfigurationError(
      error instanceof Error ? error.message : "The server environment is invalid.",
    );
  }

  const assistant = orcha.assistant as AgentRuntime | undefined;
  if (!assistant) {
    throw new AppConfigurationError(
      'The "assistant" agent is not registered in orcha/index.ts.',
    );
  }
  return assistant;
}
