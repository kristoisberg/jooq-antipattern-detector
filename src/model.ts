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

type ProviderId = "google" | "anthropic" | "openai" | "openrouter";

type ProviderDefinition = {
  id: ProviderId;
  apiKeyField: keyof ModelApiKeys;
  envName: string;
  cliFlag: string;
  create: (modelId: string, apiKey: string) => LanguageModelV1;
};

type ResolvedProvider = {
  definition: ProviderDefinition;
  modelId: string;
};

const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  google: {
    id: "google",
    apiKeyField: "gemini",
    envName: "GEMINI_API_KEY",
    cliFlag: "--gemini-api-key",
    create: (modelId, apiKey) =>
      createGoogleGenerativeAI({
        apiKey,
      })(modelId),
  },
  anthropic: {
    id: "anthropic",
    apiKeyField: "anthropic",
    envName: "ANTHROPIC_API_KEY",
    cliFlag: "--anthropic-api-key",
    create: (modelId, apiKey) =>
      createAnthropic({
        apiKey,
      })(modelId),
  },
  openai: {
    id: "openai",
    apiKeyField: "openai",
    envName: "OPENAI_API_KEY",
    cliFlag: "--openai-api-key",
    create: (modelId, apiKey) =>
      createOpenAI({
        apiKey,
      })(modelId),
  },
  openrouter: {
    id: "openrouter",
    apiKeyField: "openrouter",
    envName: "OPENROUTER_API_KEY",
    cliFlag: "--openrouter-api-key",
    create: (modelId, apiKey) =>
      createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      })(modelId),
  },
};

export function createModel(modelId: string, apiKeys: ModelApiKeys): LanguageModelV1 {
  const resolved = resolveProvider(modelId);
  const apiKey = apiKeys[resolved.definition.apiKeyField];

  if (!apiKey) {
    throw new Error(
      `Missing API key for ${resolved.definition.id}. Provide ${resolved.definition.cliFlag} or set ${resolved.definition.envName}.`,
    );
  }

  return resolved.definition.create(resolved.modelId, apiKey);
}

function resolveProvider(modelId: string): ResolvedProvider {
  const normalizedModelId = modelId.trim();
  if (!normalizedModelId) {
    throw new Error("Model identifier must be a non-empty string.");
  }

  const separatorIndex = normalizedModelId.indexOf(":");
  if (separatorIndex === -1) {
    throw new Error(
      'Model identifier must use an explicit provider prefix, for example "google:gemini-2.5-pro".',
    );
  }

  const providerId = normalizedModelId.slice(0, separatorIndex).trim() as ProviderId;
  const providerModelId = normalizedModelId.slice(separatorIndex + 1).trim();

  if (!(providerId in PROVIDERS)) {
    throw new Error(
      `Unsupported provider prefix "${normalizedModelId.slice(0, separatorIndex)}". Use "google:", "anthropic:", "openai:", or "openrouter:".`,
    );
  }

  if (!providerModelId) {
    throw new Error(`Provider prefix "${providerId}" must be followed by a model identifier.`);
  }

  return {
    definition: PROVIDERS[providerId],
    modelId: providerModelId,
  };
}
