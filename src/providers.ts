import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

export type ProviderId = "google" | "anthropic" | "openai" | "openrouter";

export type ModelApiKeys = {
  gemini?: string;
  anthropic?: string;
  openai?: string;
  openrouter?: string;
};

export type ProviderDefinition = {
  id: ProviderId;
  apiKeyField: keyof ModelApiKeys;
  apiKeyDescription: string;
  envName: string;
  cliFlag: string;
  create: (modelId: string, apiKey: string) => LanguageModelV1;
};

export const PROVIDER_DEFINITIONS = [
  {
    id: "google",
    apiKeyField: "gemini",
    apiKeyDescription: "Google Gemini API key",
    envName: "GEMINI_API_KEY",
    cliFlag: "--gemini-api-key",
    create: (modelId, apiKey) =>
      createGoogleGenerativeAI({
        apiKey,
      })(modelId),
  },
  {
    id: "anthropic",
    apiKeyField: "anthropic",
    apiKeyDescription: "Anthropic API key",
    envName: "ANTHROPIC_API_KEY",
    cliFlag: "--anthropic-api-key",
    create: (modelId, apiKey) =>
      createAnthropic({
        apiKey,
      })(modelId),
  },
  {
    id: "openai",
    apiKeyField: "openai",
    apiKeyDescription: "OpenAI API key",
    envName: "OPENAI_API_KEY",
    cliFlag: "--openai-api-key",
    create: (modelId, apiKey) =>
      createOpenAI({
        apiKey,
      })(modelId),
  },
  {
    id: "openrouter",
    apiKeyField: "openrouter",
    apiKeyDescription: "OpenRouter API key",
    envName: "OPENROUTER_API_KEY",
    cliFlag: "--openrouter-api-key",
    create: (modelId, apiKey) =>
      createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      })(modelId),
  },
] as const satisfies readonly ProviderDefinition[];

export const PROVIDERS_BY_ID: Record<ProviderId, ProviderDefinition> = Object.fromEntries(
  PROVIDER_DEFINITIONS.map((provider) => [provider.id, provider]),
) as Record<ProviderId, ProviderDefinition>;
