import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

export type ModelApiKeys = {
  gemini?: string;
  anthropic?: string;
  openai?: string;
  openrouter?: string;
};

export function createModel(modelId: string, apiKeys: ModelApiKeys): LanguageModelV1 {
  const normalizedModelId = modelId.trim();
  const [explicitProvider, ...rest] = normalizedModelId.split(":");

  if (rest.length > 0) {
    return instantiateProvider(explicitProvider, rest.join(":"), apiKeys);
  }

  if (looksLikeGoogleModel(normalizedModelId)) {
    return instantiateProvider("google", normalizedModelId, apiKeys);
  }

  if (looksLikeAnthropicModel(normalizedModelId)) {
    return instantiateProvider("anthropic", normalizedModelId, apiKeys);
  }

  return instantiateProvider("openai", normalizedModelId, apiKeys);
}

function instantiateProvider(provider: string, modelId: string, apiKeys: ModelApiKeys): LanguageModelV1 {
  switch (provider) {
    case "google":
    case "gemini":
      requireApiKey(apiKeys.gemini, "GEMINI_API_KEY", "--gemini-api-key");
      return createGoogleGenerativeAI({
        apiKey: apiKeys.gemini,
      })(modelId);
    case "anthropic":
    case "claude":
      requireApiKey(apiKeys.anthropic, "ANTHROPIC_API_KEY", "--anthropic-api-key");
      return createAnthropic({
        apiKey: apiKeys.anthropic,
      })(modelId);
    case "openai":
    case "gpt":
      requireApiKey(apiKeys.openai, "OPENAI_API_KEY", "--openai-api-key");
      return createOpenAI({
        apiKey: apiKeys.openai,
      })(modelId);
    case "openrouter":
      requireApiKey(apiKeys.openrouter, "OPENROUTER_API_KEY", "--openrouter-api-key");
      return createOpenAI({
        apiKey: apiKeys.openrouter,
        baseURL: "https://openrouter.ai/api/v1",
      })(modelId);
    default:
      throw new Error(
        `Unsupported provider prefix "${provider}". Use "google:", "anthropic:", "openai:", or "openrouter:".`,
      );
  }
}

function looksLikeGoogleModel(modelId: string): boolean {
  return modelId.startsWith("gemini");
}

function looksLikeAnthropicModel(modelId: string): boolean {
  return modelId.startsWith("claude");
}

function requireApiKey(value: string | undefined, envName: string, cliFlag: string): void {
  if (!value) {
    throw new Error(`Missing API key. Provide ${cliFlag} or set ${envName}.`);
  }
}
