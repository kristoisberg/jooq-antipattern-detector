import { describe, expect, test } from "bun:test";
import type { LanguageModelV1 } from "ai";

import { createModel, type ModelDeps } from "../model.js";

function createStubDeps(): { deps: ModelDeps; calls: Array<{ provider: string; modelId: string; apiKey: string }> } {
  const calls: Array<{ provider: string; modelId: string; apiKey: string }> = [];

  return {
    calls,
    deps: {
      providers: {
        google: {
          id: "google",
          apiKeyField: "gemini",
          envName: "GEMINI_API_KEY",
          cliFlag: "--gemini-api-key",
          create: (modelId, apiKey) => {
            calls.push({ provider: "google", modelId, apiKey });
            return { provider: "google", modelId } as LanguageModelV1;
          },
        },
        anthropic: {
          id: "anthropic",
          apiKeyField: "anthropic",
          envName: "ANTHROPIC_API_KEY",
          cliFlag: "--anthropic-api-key",
          create: (modelId, apiKey) => {
            calls.push({ provider: "anthropic", modelId, apiKey });
            return { provider: "anthropic", modelId } as LanguageModelV1;
          },
        },
        openai: {
          id: "openai",
          apiKeyField: "openai",
          envName: "OPENAI_API_KEY",
          cliFlag: "--openai-api-key",
          create: (modelId, apiKey) => {
            calls.push({ provider: "openai", modelId, apiKey });
            return { provider: "openai", modelId } as LanguageModelV1;
          },
        },
        openrouter: {
          id: "openrouter",
          apiKeyField: "openrouter",
          envName: "OPENROUTER_API_KEY",
          cliFlag: "--openrouter-api-key",
          create: (modelId, apiKey) => {
            calls.push({ provider: "openrouter", modelId, apiKey });
            return { provider: "openrouter", modelId } as LanguageModelV1;
          },
        },
      },
    },
  };
}

describe("createModel", () => {
  test("routes explicit google models through the google provider", () => {
    const { deps, calls } = createStubDeps();

    const model = createModel("google:gemini-2.5-pro", { gemini: "test-key" }, deps);

    expect(model).toMatchObject({ provider: "google", modelId: "gemini-2.5-pro" });
    expect(calls).toEqual([{ provider: "google", modelId: "gemini-2.5-pro", apiKey: "test-key" }]);
  });

  test("routes explicit anthropic models through the anthropic provider", () => {
    const { deps, calls } = createStubDeps();

    createModel("anthropic:claude-3-7-sonnet-latest", { anthropic: "test-key" }, deps);

    expect(calls).toEqual([{ provider: "anthropic", modelId: "claude-3-7-sonnet-latest", apiKey: "test-key" }]);
  });

  test("routes explicit openai models through the openai provider", () => {
    const { deps, calls } = createStubDeps();

    createModel("openai:gpt-4.1", { openai: "test-key" }, deps);

    expect(calls).toEqual([{ provider: "openai", modelId: "gpt-4.1", apiKey: "test-key" }]);
  });

  test("supports explicit openrouter models", () => {
    const { deps, calls } = createStubDeps();

    createModel("openrouter:openai/gpt-4.1", { openrouter: "test-key" }, deps);

    expect(calls).toEqual([{ provider: "openrouter", modelId: "openai/gpt-4.1", apiKey: "test-key" }]);
  });

  test("constructs default google provider models", () => {
    expect(() => createModel("google:gemini-2.5-pro", { gemini: "test-key" })).not.toThrow();
  });

  test("constructs default anthropic provider models", () => {
    expect(() => createModel("anthropic:claude-3-7-sonnet-latest", { anthropic: "test-key" })).not.toThrow();
  });

  test("constructs default openai provider models", () => {
    expect(() => createModel("openai:gpt-4.1", { openai: "test-key" })).not.toThrow();
  });

  test("constructs default openrouter provider models", () => {
    expect(() => createModel("openrouter:openai/gpt-4.1", { openrouter: "test-key" })).not.toThrow();
  });

  test("requires an explicit provider prefix", () => {
    expect(() => createModel("gpt-4.1", { openai: "test-key" })).toThrow(
      'Model identifier must use an explicit provider prefix, for example "google:gemini-2.5-pro".',
    );
  });

  test("rejects whitespace-only model identifiers", () => {
    expect(() => createModel("   ", { openai: "test-key" })).toThrow("Model identifier must be a non-empty string.");
  });

  test("rejects unsupported provider prefixes", () => {
    expect(() => createModel("gemini:gemini-2.5-pro", { gemini: "test-key" })).toThrow(
      'Unsupported provider prefix "gemini". Use "google:", "anthropic:", "openai:", or "openrouter:".',
    );
  });

  test("rejects missing model ids after a valid prefix", () => {
    expect(() => createModel("openai:   ", { openai: "test-key" })).toThrow(
      'Provider prefix "openai" must be followed by a model identifier.',
    );
  });

  test("fails with a provider-specific API key error", () => {
    expect(() => createModel("openrouter:openai/gpt-4.1", {})).toThrow(
      "Missing API key for openrouter. Provide --openrouter-api-key or set OPENROUTER_API_KEY.",
    );
  });
});
