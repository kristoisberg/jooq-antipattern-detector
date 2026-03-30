import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, test } from "bun:test";

import { Command } from "commander";

import { registerCliOptions, resolveConfig } from "../config.js";

describe("resolveConfig", () => {
  test("uses environment values when CLI args are absent", () => {
    const config = resolveConfig([], {
      SQL_ANTIPATTERN_DETECTOR_MODEL: "openrouter:openai/gpt-4.1",
      SQL_ANTIPATTERN_DETECTOR_MODE: "classification",
      SQL_ANTIPATTERN_DETECTOR_CONCURRENCY: "4",
      SQL_ANTIPATTERN_DETECTOR_RETRIES: "3",
      SQL_ANTIPATTERN_DETECTOR_THINKING_EFFORT: "high",
      SQL_ANTIPATTERN_DETECTOR_FORMAT: "csv",
      SQL_ANTIPATTERN_DETECTOR_OUTPUT: "reports/findings.json",
      SQL_ANTIPATTERN_DETECTOR_DEBUG: "true",
      OPENROUTER_API_KEY: "env-key",
    });

    expect(config.model).toBe("openrouter:openai/gpt-4.1");
    expect(config.mode).toBe("classification");
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
      ["--concurrency", "7", "--thinking-effort", "xhigh", "--debug", "false", "--openai-api-key", "cli-key"],
      {
        SQL_ANTIPATTERN_DETECTOR_CONCURRENCY: "2",
        SQL_ANTIPATTERN_DETECTOR_THINKING_EFFORT: "high",
        SQL_ANTIPATTERN_DETECTOR_DEBUG: "true",
        OPENAI_API_KEY: "env-key",
      },
    );

    expect(config.concurrency).toBe(7);
    expect(config.thinkingEffort).toBe("xhigh");
    expect(config.debug).toBe(false);
    expect(config.apiKeys.openai).toBe("cli-key");
  });

  test("accepts newly supported thinking effort values from the environment", () => {
    const config = resolveConfig([], {
      SQL_ANTIPATTERN_DETECTOR_THINKING_EFFORT: "minimal",
    });

    expect(config.thinkingEffort).toBe("minimal");
  });

  test("falls back to defaults when env and CLI are absent", () => {
    const config = resolveConfig([], {});

    expect(config.model).toBe("anthropic:claude-opus-4-5");
    expect(config.mode).toBe("localisation");
    expect(config.concurrency).toBe(8);
    expect(config.retries).toBe(2);
    expect(config.thinkingEffort).toBe("none");
    expect(config.format).toBe("text");
    expect(config.debug).toBe(false);
  });

  test("loads values from a YAML config file", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "detecty-config-"));
    const configFile = path.join(directory, "config.yml");

    try {
      writeFileSync(
        configFile,
        [
          "model: openai:gpt-4.1",
          "mode: classification",
          "concurrency: 5",
          "retries: 4",
          "thinkingEffort: medium",
          "format: json",
          "output: reports/findings.json",
          "debug: true",
          "apiKeys:",
          "  openai: yaml-key",
          "",
        ].join("\n"),
        "utf8",
      );

      const config = resolveConfig(["--config-file", configFile], {});

      expect(config.model).toBe("openai:gpt-4.1");
      expect(config.mode).toBe("classification");
      expect(config.concurrency).toBe(5);
      expect(config.retries).toBe(4);
      expect(config.thinkingEffort).toBe("medium");
      expect(config.format).toBe("json");
      expect(config.output).toBe("reports/findings.json");
      expect(config.debug).toBe(true);
      expect(config.apiKeys.openai).toBe("yaml-key");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("applies environment values over YAML config values", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "detecty-config-"));
    const configFile = path.join(directory, "config.yml");

    try {
      writeFileSync(
        configFile,
        ["concurrency: 3", "debug: false", "apiKeys:", "  openai: yaml-key", ""].join("\n"),
        "utf8",
      );

      const config = resolveConfig([], {
        SQL_ANTIPATTERN_DETECTOR_CONFIG_FILE: configFile,
        SQL_ANTIPATTERN_DETECTOR_CONCURRENCY: "9",
        SQL_ANTIPATTERN_DETECTOR_DEBUG: "true",
        OPENAI_API_KEY: "env-key",
      });

      expect(config.concurrency).toBe(9);
      expect(config.debug).toBe(true);
      expect(config.apiKeys.openai).toBe("env-key");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("applies CLI values over environment and YAML config values", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "detecty-config-"));
    const configFile = path.join(directory, "config.yml");

    try {
      writeFileSync(configFile, ["concurrency: 3", "debug: false", ""].join("\n"), "utf8");

      const config = resolveConfig(["--config-file", configFile, "--concurrency", "7", "--debug", "false"], {
        SQL_ANTIPATTERN_DETECTOR_CONCURRENCY: "5",
        SQL_ANTIPATTERN_DETECTOR_DEBUG: "true",
      });

      expect(config.concurrency).toBe(7);
      expect(config.debug).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("prefers the CLI config file location over the environment variable", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "detecty-config-"));
    const cliConfigFile = path.join(directory, "cli.yml");
    const envConfigFile = path.join(directory, "env.yml");

    try {
      writeFileSync(cliConfigFile, ["concurrency: 6", ""].join("\n"), "utf8");
      writeFileSync(envConfigFile, ["concurrency: 2", ""].join("\n"), "utf8");

      const config = resolveConfig(["--config-file", cliConfigFile], {
        SQL_ANTIPATTERN_DETECTOR_CONFIG_FILE: envConfigFile,
      });

      expect(config.concurrency).toBe(6);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("uses the home-directory YAML config file when no location is provided", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "detecty-home-"));
    const configFile = path.join(directory, ".sql-antipattern-detector.yml");

    try {
      writeFileSync(configFile, ["format: csv", ""].join("\n"), "utf8");

      const config = resolveConfig(
        [],
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

  test("rejects an invalid mode value", () => {
    expect(() => resolveConfig(["--mode", "invalid"], {})).toThrow();
  });

  test("rejects invalid positive integer values", () => {
    expect(() => resolveConfig(["--concurrency", "0"], {})).toThrow("must be a positive integer");
  });

  test("throws when an explicitly configured config file does not exist", () => {
    expect(() =>
      resolveConfig([], {
        SQL_ANTIPATTERN_DETECTOR_CONFIG_FILE: "/tmp/missing-config.yml",
      }),
    ).toThrow("Config file does not exist: /tmp/missing-config.yml");
  });

  test("ignores the default home config file when it does not exist", () => {
    const config = resolveConfig(
      [],
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
    const directory = mkdtempSync(path.join(tmpdir(), "detecty-config-"));
    const configFile = path.join(directory, "invalid.yml");

    try {
      writeFileSync(configFile, "format: [\n", "utf8");

      expect(() => resolveConfig(["--config-file", configFile], {})).toThrow(
        `Failed to parse YAML config file at ${configFile}:`,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
