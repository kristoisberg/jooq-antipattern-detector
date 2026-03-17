import { describe, expect, test } from "bun:test";

import { createModel } from "./model.js";

describe("createModel", () => {
  test("supports explicit openrouter models", () => {
    expect(() =>
      createModel("openrouter:openai/gpt-4.1", {
        openrouter: "test-key",
      }),
    ).not.toThrow();
  });

  test("requires an explicit provider prefix", () => {
    expect(() =>
      createModel("gpt-4.1", {
        openai: "test-key",
      }),
    ).toThrow('Model identifier must use an explicit provider prefix, for example "google:gemini-2.5-pro".');
  });

  test("rejects unsupported provider prefixes", () => {
    expect(() =>
      createModel("gemini:gemini-2.5-pro", {
        gemini: "test-key",
      }),
    ).toThrow('Unsupported provider prefix "gemini". Use "google:", "anthropic:", "openai:", or "openrouter:".');
  });

  test("fails with a provider-specific API key error", () => {
    expect(() => createModel("openrouter:openai/gpt-4.1", {})).toThrow(
      "Missing API key for openrouter. Provide --openrouter-api-key or set OPENROUTER_API_KEY.",
    );
  });
});
