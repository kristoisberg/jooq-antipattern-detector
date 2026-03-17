import { describe, expect, test } from "bun:test";

import { Command } from "commander";

import { registerCliOptions, resolveConfig } from "../config.js";

describe("resolveConfig", () => {
  test("uses environment values when CLI args are absent", () => {
    const config = resolveConfig([], {
      SQL_ANTIPATTERN_DETECTOR_MODEL: "openrouter:openai/gpt-4.1",
      SQL_ANTIPATTERN_DETECTOR_CONCURRENCY: "4",
      SQL_ANTIPATTERN_DETECTOR_RETRIES: "3",
      SQL_ANTIPATTERN_DETECTOR_THINKING_EFFORT: "high",
      SQL_ANTIPATTERN_DETECTOR_FORMAT: "csv",
      SQL_ANTIPATTERN_DETECTOR_OUTPUT: "reports/findings.json",
      SQL_ANTIPATTERN_DETECTOR_DEBUG: "true",
      OPENROUTER_API_KEY: "env-key",
    });

    expect(config.model).toBe("openrouter:openai/gpt-4.1");
    expect(config.concurrency).toBe(4);
    expect(config.retries).toBe(3);
    expect(config.thinkingEffort).toBe("high");
    expect(config.format).toBe("csv");
    expect(config.output).toBe("reports/findings.json");
    expect(config.debug).toBe(true);
    expect(config.apiKeys.openrouter).toBe("env-key");
  });

  test("applies CLI args over environment values", () => {
    const config = resolveConfig(
      ["--concurrency", "7", "--thinking-effort", "low", "--debug", "false", "--openai-api-key", "cli-key"],
      {
        SQL_ANTIPATTERN_DETECTOR_CONCURRENCY: "2",
        SQL_ANTIPATTERN_DETECTOR_THINKING_EFFORT: "high",
        SQL_ANTIPATTERN_DETECTOR_DEBUG: "true",
        OPENAI_API_KEY: "env-key",
      },
    );

    expect(config.concurrency).toBe(7);
    expect(config.thinkingEffort).toBe("low");
    expect(config.debug).toBe(false);
    expect(config.apiKeys.openai).toBe("cli-key");
  });

  test("falls back to defaults when env and CLI are absent", () => {
    const config = resolveConfig([], {});

    expect(config.model).toBe("google:gemini-2.5-pro");
    expect(config.concurrency).toBe(8);
    expect(config.retries).toBe(2);
    expect(config.thinkingEffort).toBe("medium");
    expect(config.format).toBe("text");
    expect(config.debug).toBe(false);
  });

  test("registers the supported CLI options", () => {
    const program = new Command();
    registerCliOptions(program);

    expect(program.options.map((option) => option.long)).toEqual([
      "--model",
      "--concurrency",
      "--retries",
      "--thinking-effort",
      "--format",
      "--output",
      "--debug",
      "--gemini-api-key",
      "--anthropic-api-key",
      "--openai-api-key",
      "--openrouter-api-key",
    ]);
  });

  test("rejects an empty model value", () => {
    expect(() => resolveConfig(["--model", ""], {})).toThrow("must be a non-empty string");
  });

  test("rejects invalid positive integer values", () => {
    expect(() => resolveConfig(["--concurrency", "0"], {})).toThrow("must be a positive integer");
  });
});
