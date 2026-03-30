import type { LanguageModelV1 } from "ai";

import { PROVIDERS_BY_ID, type ModelApiKeys, type ProviderDefinition, type ProviderId } from "./providers.js";

export type ResolvedProvider = {
  providerId: ProviderId;
  definition: ProviderDefinition;
  modelId: string;
};

export type ModelDeps = {
  providers: Record<ProviderId, ProviderDefinition>;
};

const defaultModelDeps: ModelDeps = {
  providers: PROVIDERS_BY_ID,
};

export function createModel(
  modelId: string,
  apiKeys: ModelApiKeys,
  deps: ModelDeps = defaultModelDeps,
): LanguageModelV1 {
  const resolved = resolveProviderModel(modelId, deps.providers);
  const apiKey = apiKeys[resolved.definition.apiKeyField];

  if (!apiKey) {
    throw new Error(
      `Missing API key for ${resolved.definition.id}. Provide ${resolved.definition.cliFlag} or set ${resolved.definition.envName}.`,
    );
  }

  return resolved.definition.create(resolved.modelId, apiKey);
}

export function parseModelIdentifier(modelId: string): { providerId: ProviderId; modelId: string } {
  const normalizedModelId = modelId.trim();

  if (!normalizedModelId) {
    throw new Error("Model identifier must be a non-empty string.");
  }

  const separatorIndex = normalizedModelId.indexOf(":");
  if (separatorIndex === -1) {
    throw new Error('Model identifier must use an explicit provider prefix, for example "google:gemini-2.5-pro".');
  }

  const providerId = normalizedModelId.slice(0, separatorIndex).trim() as ProviderId;
  const providerModelId = normalizedModelId.slice(separatorIndex + 1).trim();

  if (!providerModelId) {
    throw new Error(`Provider prefix "${providerId}" must be followed by a model identifier.`);
  }

  return {
    providerId,
    modelId: providerModelId,
  };
}

export function resolveProviderModel(modelId: string, providers: ModelDeps["providers"]): ResolvedProvider {
  const parsed = parseModelIdentifier(modelId);
  const providerPrefix = modelId.trim().slice(0, modelId.trim().indexOf(":"));

  if (!(parsed.providerId in providers)) {
    throw new Error(
      `Unsupported provider prefix "${providerPrefix}". Use "google:", "anthropic:", "openai:", or "openrouter:".`,
    );
  }

  return {
    providerId: parsed.providerId,
    definition: providers[parsed.providerId],
    modelId: parsed.modelId,
  };
}
