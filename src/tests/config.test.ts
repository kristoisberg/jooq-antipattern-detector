import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, test } from "bun:test";

import { getCliOverrides, registerCliOptions, resolveConfig } from "../config.js";
import { Command } from "commander";

describe("resolveConfig", () => {
  test("uses environment values when CLI args are absent", () => {
    const config = resolveConfig(
      {},
      {
        JOOQ_ANTIPATTERN_DETECTOR_MODEL: "openrouter:openai/gpt-4.1",
        JOOQ_ANTIPATTERN_DETECTOR_MODE: "classification",
        JOOQ_ANTIPATTERN_DETECTOR_CONCURRENCY: "4",
        JOOQ_ANTIPATTERN_DETECTOR_RETRIES: "3",
        JOOQ_ANTIPATTERN_DETECTOR_TEMPERATURE: "0.7",
        JOOQ_ANTIPATTERN_DETECTOR_THINKING_EFFORT: "high",
        JOOQ_ANTIPATTERN_DETECTOR_MAX_PROMPT_CHARS: "321000",
        JOOQ_ANTIPATTERN_DETECTOR_PROMPTS_FILE: "prompt-pack.json",
        JOOQ_ANTIPATTERN_DETECTOR_FORMAT: "csv",
        JOOQ_ANTIPATTERN_DETECTOR_OUTPUT: "reports/findings.json",
        JOOQ_ANTIPATTERN_DETECTOR_DEBUG: "true",
        OPENROUTER_API_KEY: "env-key",
      },
    );

    expect(config.model).toBe("openrouter:openai/gpt-4.1");
    expect(config.mode).toBe("classification");
    expect(config.concurrency).toBe(4);
    expect(config.retries).toBe(3);
    expect(config.temperature).toBe(0.7);
    expect(config.thinkingEffort).toBe("high");
    expect(config.maxPromptChars).toBe(321000);
    expect(config.promptsFile).toBe(`${process.cwd()}/prompt-pack.json`);
    expect(config.format).toBe("csv");
    expect(config.output).toBe(`${process.cwd()}/reports/findings.json`);
    expect(config.debug).toBe(true);
    expect(config.apiKeys.openrouter).toBe("env-key");
  });

  test("applies CLI overrides over environment values", () => {
    const config = resolveConfig(
      {
        concurrency: 7,
        temperature: 0.2,
        thinkingEffort: "xhigh",
        maxPromptChars: 456789,
        debug: true,
        apiKeys: {
          openai: "cli-key",
        },
      },
      {
        JOOQ_ANTIPATTERN_DETECTOR_CONCURRENCY: "2",
        JOOQ_ANTIPATTERN_DETECTOR_TEMPERATURE: "0.9",
        JOOQ_ANTIPATTERN_DETECTOR_THINKING_EFFORT: "high",
        JOOQ_ANTIPATTERN_DETECTOR_MAX_PROMPT_CHARS: "321000",
        JOOQ_ANTIPATTERN_DETECTOR_DEBUG: "true",
        OPENAI_API_KEY: "env-key",
      },
    );

    expect(config.concurrency).toBe(7);
    expect(config.temperature).toBe(0.2);
    expect(config.thinkingEffort).toBe("xhigh");
    expect(config.maxPromptChars).toBe(456789);
    expect(config.debug).toBe(true);
    expect(config.apiKeys.openai).toBe("cli-key");
  });

  test("accepts newly supported thinking effort values from the environment", () => {
    const config = resolveConfig(
      {},
      {
        JOOQ_ANTIPATTERN_DETECTOR_THINKING_EFFORT: "minimal",
      },
    );

    expect(config.thinkingEffort).toBe("minimal");
  });

  test("falls back to defaults when env and CLI are absent", () => {
    const config = resolveConfig({}, {});

    expect(config.model).toBe("anthropic:claude-opus-4-5");
    expect(config.mode).toBe("localisation");
    expect(config.concurrency).toBe(8);
    expect(config.retries).toBe(2);
    expect(config.temperature).toBe(0);
    expect(config.thinkingEffort).toBe("none");
    expect(config.maxPromptChars).toBeUndefined();
    expect(config.promptsFile).toBeUndefined();
    expect(config.format).toBe("text");
    expect(config.debug).toBe(false);
  });

  test("loads values from a YAML config file", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "detector-config-"));
    const configFile = path.join(directory, "config.yml");

    try {
      writeFileSync(
        configFile,
        [
          "model: openai:gpt-4.1",
          "mode: classification",
          "concurrency: 5",
          "retries: 4",
          "temperature: 0.4",
          "thinkingEffort: medium",
          "maxPromptChars: 654321",
          "promptsFile: prompt-pack.json",
          "format: json",
          "output: reports/findings.json",
          "debug: true",
          "apiKeys:",
          "  openai: yaml-key",
          "",
        ].join("\n"),
        "utf8",
      );

      const config = resolveConfig({ configFile }, {});

      expect(config.model).toBe("openai:gpt-4.1");
      expect(config.mode).toBe("classification");
      expect(config.concurrency).toBe(5);
      expect(config.retries).toBe(4);
      expect(config.temperature).toBe(0.4);
      expect(config.thinkingEffort).toBe("medium");
      expect(config.maxPromptChars).toBe(654321);
      expect(config.promptsFile).toBe(`${process.cwd()}/prompt-pack.json`);
      expect(config.format).toBe("json");
      expect(config.output).toBe(`${process.cwd()}/reports/findings.json`);
      expect(config.debug).toBe(true);
      expect(config.apiKeys.openai).toBe("yaml-key");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("applies environment values over YAML config values", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "detector-config-"));
    const configFile = path.join(directory, "config.yml");

    try {
      writeFileSync(
        configFile,
        ["concurrency: 3", "debug: false", "apiKeys:", "  openai: yaml-key", ""].join("\n"),
        "utf8",
      );

      const config = resolveConfig(
        { configFile },
        {
          JOOQ_ANTIPATTERN_DETECTOR_CONCURRENCY: "9",
          JOOQ_ANTIPATTERN_DETECTOR_DEBUG: "true",
          OPENAI_API_KEY: "env-key",
        },
      );

      expect(config.concurrency).toBe(9);
      expect(config.debug).toBe(true);
      expect(config.apiKeys.openai).toBe("env-key");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("applies CLI values over environment and YAML config values", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "detector-config-"));
    const configFile = path.join(directory, "config.yml");

    try {
      writeFileSync(configFile, ["concurrency: 3", "debug: false", ""].join("\n"), "utf8");

      const config = resolveConfig(
        { configFile, concurrency: 7, debug: true },
        {
          JOOQ_ANTIPATTERN_DETECTOR_CONCURRENCY: "5",
          JOOQ_ANTIPATTERN_DETECTOR_DEBUG: "false",
        },
      );

      expect(config.concurrency).toBe(7);
      expect(config.debug).toBe(true);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("treats CLI booleans as flags", () => {
    const config = resolveConfig({ debug: true }, {});

    expect(config.debug).toBe(true);
  });

  test("ignores JOOQ_ANTIPATTERN_DETECTOR_CONFIG_FILE when set", () => {
    const config = resolveConfig(
      {},
      {
        JOOQ_ANTIPATTERN_DETECTOR_CONFIG_FILE: "/tmp/ignored-detector.yml",
      },
      {
        existsSync: () => false,
        readFileSync: () => {
          throw new Error("readFileSync should not be called");
        },
        homedir: () => "/tmp/non-existent-home",
      },
    );

    expect(config.format).toBe("text");
  });

  test("uses the home-directory YAML config file when no location is provided", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "detector-home-"));
    const configFile = path.join(directory, ".jooq-antipattern-detector.yml");

    try {
      writeFileSync(configFile, ["format: csv", ""].join("\n"), "utf8");

      const config = resolveConfig(
        {},
        {},
        {
          existsSync: (filePath) => filePath === configFile,
          readFileSync: () => "format: csv\n",
          homedir: () => directory,
        },
      );

      expect(config.format).toBe("csv");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("registers the supported CLI options", () => {
    const program = new Command();
    registerCliOptions(program);

    expect(program.options.map((option) => option.long)).toEqual([
      "--config-file",
      "--model",
      "--mode",
      "--concurrency",
      "--retries",
      "--temperature",
      "--thinking-effort",
      "--max-prompt-chars",
      "--prompts-file",
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
    expect(() => resolveConfig({ model: "" }, {})).toThrow("Invalid configuration: must be a non-empty string");
  });

  test("rejects an invalid mode value", () => {
    expect(() => resolveConfig({ mode: "invalid" as never }, {})).toThrow();
  });

  test("rejects invalid positive integer values", () => {
    expect(() => resolveConfig({ concurrency: 0 }, {})).toThrow("Invalid configuration: must be a positive integer");
    expect(() => resolveConfig({ maxPromptChars: 0 }, {})).toThrow("Invalid configuration: must be a positive integer");
  });

  test("rejects invalid temperature values", () => {
    expect(() => resolveConfig({ temperature: Number.NaN }, {})).toThrow(
      "Invalid configuration: Expected number, received nan",
    );
  });

  test("maps commander options into CLI overrides", () => {
    const overrides = getCliOverrides({
      concurrency: 7,
      temperature: "0.3",
      thinkingEffort: "xhigh",
      maxPromptChars: "123456",
      promptsFile: "prompt-pack.json",
      debug: true,
      configFile: "/tmp/detector.yml",
      openaiApiKey: "cli-key",
    });

    expect(overrides).toEqual({
      concurrency: 7,
      temperature: 0.3,
      thinkingEffort: "xhigh",
      maxPromptChars: 123456,
      promptsFile: "prompt-pack.json",
      debug: true,
      configFile: "/tmp/detector.yml",
      apiKeys: {
        openai: "cli-key",
      },
    });
  });

  test("throws when an explicitly configured config file does not exist", () => {
    expect(() => resolveConfig({ configFile: "/tmp/missing-config.yml" }, {})).toThrow(
      "Config file does not exist: /tmp/missing-config.yml",
    );
  });

  test("ignores the default home config file when it does not exist", () => {
    const config = resolveConfig(
      {},
      {},
      {
        existsSync: () => false,
        readFileSync: () => {
          throw new Error("readFileSync should not be called");
        },
        homedir: () => "/tmp/non-existent-home",
      },
    );

    expect(config.format).toBe("text");
  });

  test("throws when the YAML config file is invalid", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "detector-config-"));
    const configFile = path.join(directory, "invalid.yml");

    try {
      writeFileSync(configFile, "format: [\n", "utf8");

      expect(() => resolveConfig({ configFile }, {})).toThrow(`Failed to parse YAML config file at ${configFile}:`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
