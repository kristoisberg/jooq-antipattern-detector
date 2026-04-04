import { describe, expect, test } from "bun:test";

import type { Stats } from "node:fs";

import { createProgram, executeCli, renderCliOutput } from "../cli.js";
import type { CliOutput } from "../output.js";

const directoryStats = {
  isDirectory: () => true,
} as Stats;

const fileStats = {
  isDirectory: () => false,
} as Stats;

const baseOutput: CliOutput = {
  rootDirectory: "/tmp/project",
  model: "google:gemini-2.5-pro",
  mode: "localisation",
  generatedAt: "2025-01-01T00:00:00.000Z",
  results: [],
  summary: {
    scannedJavaFiles: 0,
    applicableFiles: 0,
    analyzedFiles: 0,
    failedFiles: 0,
    filesWithFindings: 0,
    totalOccurrences: 0,
    distinctAntipatterns: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  },
};

describe("renderCliOutput", () => {
  test("appends a trailing newline to rendered output", () => {
    expect(renderCliOutput(baseOutput, "text")).toEndWith("\n");
  });
});

describe("createProgram", () => {
  test("creates the configured command program", () => {
    const program = createProgram();

    expect(program.name()).toBe("sql-antipattern-detector");
    expect(program.description()).toBe("Detect SQL antipatterns in Java/jOOQ codebases with an LLM-backed analyzer.");
    expect(program.options.some((option) => option.long === "--format")).toBe(true);
  });

  test("describes the supported thinking effort values in help text", () => {
    const program = createProgram();
    const option = program.options.find((candidate) => candidate.long === "--thinking-effort");

    expect(option?.description).toBe(
      "Thinking effort for supported reasoning models: none, minimal, low, medium, high, or xhigh",
    );
  });
});

describe("executeCli", () => {
  test("creates the parent directory automatically when --output is used", async () => {
    const calls: Array<{ type: "mkdir" | "writeFile"; path: string; payload?: string }> = [];

    await executeCli(
      "/tmp/project",
      { output: "reports/findings.json", apiKeys: { anthropic: "test-key" } },
      {
        runAnalysis: async () => baseOutput,
        mkdir: async (dir) => {
          calls.push({ type: "mkdir", path: dir.toString() });
        },
        stat: async (): Promise<Stats> => directoryStats,
        writeFile: async (filePath, contents) => {
          calls.push({ type: "writeFile", path: filePath.toString(), payload: contents.toString() });
        },
        writeStdout: () => {
          throw new Error("stdout should not be used when output file is configured");
        },
      },
    );

    expect(calls).toEqual([
      { type: "mkdir", path: `${process.cwd()}/reports` },
      {
        type: "writeFile",
        path: `${process.cwd()}/reports/findings.json`,
        payload: renderCliOutput(baseOutput, "text"),
      },
    ]);
  });

  test("throws a clear error when the input directory does not exist", async () => {
    await expect(
      executeCli(
        "/tmp/missing-project",
        { apiKeys: { anthropic: "test-key" } },
        {
          runAnalysis: async () => baseOutput,
          mkdir: async () => undefined,
          stat: async () => {
            const error = new Error("missing");
            Object.assign(error, { code: "ENOENT" });
            throw error;
          },
          writeFile: async () => undefined,
          writeStdout: () => undefined,
        },
      ),
    ).rejects.toThrow("Input directory does not exist: /tmp/missing-project");
  });

  test("throws a clear error when the input path is not a directory", async () => {
    await expect(
      executeCli(
        "/tmp/not-a-directory",
        { apiKeys: { anthropic: "test-key" } },
        {
          runAnalysis: async () => baseOutput,
          mkdir: async () => undefined,
          stat: async (): Promise<Stats> => fileStats,
          writeFile: async () => undefined,
          writeStdout: () => undefined,
        },
      ),
    ).rejects.toThrow("Input directory is not a directory: /tmp/not-a-directory");
  });

  test("config normalization resolves output paths before CLI writes files", async () => {
    let capturedOutputPath: string | undefined;

    await executeCli(
      "/tmp/project",
      { output: "reports/findings.json", apiKeys: { anthropic: "test-key" } },
      {
        runAnalysis: async (_directory, config) => {
          capturedOutputPath = config.output;
          return baseOutput;
        },
        mkdir: async () => undefined,
        stat: async (): Promise<Stats> => directoryStats,
        writeFile: async () => undefined,
        writeStdout: () => undefined,
      },
    );

    expect(capturedOutputPath).toBe(`${process.cwd()}/reports/findings.json`);
  });

  test("commander rejects boolean values for --debug on the actual CLI path", async () => {
    const program = createProgram();
    program.exitOverride();

    await expect(
      program.parseAsync(["node", "sql-antipattern-detector", "/tmp/project", "--debug=false"], { from: "node" }),
    ).rejects.toThrow("unknown option '--debug=false'");

    await expect(
      program.parseAsync(["node", "sql-antipattern-detector", "/tmp/project", "--debug", "false"], { from: "node" }),
    ).rejects.toThrow("too many arguments");
  });
});
