import { describe, expect, test } from "bun:test";

import { createProgram, executeCli } from "./cli.js";
import type { AppConfig } from "./config.js";
import type { CliOutput } from "./output.js";

const baseConfig: AppConfig = {
  model: "google:gemini-2.5-pro",
  concurrency: 1,
  retries: 2,
  format: "text",
  debug: false,
  apiKeys: {
    gemini: "test-key",
  },
};

const baseOutput: CliOutput = {
  rootDirectory: "/tmp/project",
  model: "google:gemini-2.5-pro",
  generatedAt: "2025-01-01T00:00:00.000Z",
  results: [],
  summary: {
    scannedJavaFiles: 0,
    applicableFiles: 0,
    analyzedFiles: 0,
    failedFiles: 0,
    filesWithFindings: 0,
    totalOccurrences: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  },
};

describe("executeCli", () => {
  test("writes rendered output to stdout when no output file is configured", async () => {
    const stdout: string[] = [];
    const mkdirCalls: string[] = [];
    const writeFileCalls: string[] = [];

    await executeCli("./project", ["--format", "text"], {
      resolveConfig: () => baseConfig,
      runAnalysis: async () => baseOutput,
      renderOutput: () => "rendered text",
      mkdir: async (dir) => {
        mkdirCalls.push(String(dir));
      },
      writeFile: async (file) => {
        writeFileCalls.push(String(file));
      },
      writeStdout: (message) => {
        stdout.push(message);
      },
    });

    expect(stdout).toEqual(["rendered text\n"]);
    expect(mkdirCalls).toEqual([]);
    expect(writeFileCalls).toEqual([]);
  });

  test("writes rendered output to a file when output is configured", async () => {
    const stdout: string[] = [];
    const mkdirCalls: Array<{ dir: string; recursive: boolean | undefined }> = [];
    const writeFileCalls: Array<{ file: string; contents: string; encoding: string | undefined }> = [];

    await executeCli("./project", ["--output", "reports/findings.txt"], {
      resolveConfig: () => ({
        ...baseConfig,
        output: "reports/findings.txt",
      }),
      runAnalysis: async () => baseOutput,
      renderOutput: () => "rendered text",
      mkdir: async (dir, options) => {
        const recursive =
          typeof options === "object" && options !== null && "recursive" in options
            ? Boolean(options.recursive)
            : undefined;
        mkdirCalls.push({ dir: String(dir), recursive });
      },
      writeFile: async (file, contents, encoding) => {
        writeFileCalls.push({
          file: String(file),
          contents: String(contents),
          encoding: encoding as string | undefined,
        });
      },
      writeStdout: (message) => {
        stdout.push(message);
      },
    });

    expect(stdout).toEqual([]);
    expect(mkdirCalls).toEqual([{ dir: `${process.cwd()}/reports`, recursive: true }]);
    expect(writeFileCalls).toEqual([
      {
        file: `${process.cwd()}/reports/findings.txt`,
        contents: "rendered text\n",
        encoding: "utf8",
      },
    ]);
  });

  test("creates the configured command program", () => {
    const program = createProgram();

    expect(program.name()).toBe("sql-antipattern-detector");
    expect(program.description()).toBe("Detect SQL antipatterns in Java/jOOQ codebases with an LLM-backed analyzer.");
    expect(program.options.some((option) => option.long === "--format")).toBe(true);
  });
});
