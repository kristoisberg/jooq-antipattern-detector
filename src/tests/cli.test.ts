import { describe, expect, test } from "bun:test";

import { createProgram, renderCliOutput, resolveOutputTarget } from "../cli.js";
import type { CliOutput } from "../output.js";

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

describe("renderCliOutput", () => {
  test("appends a trailing newline to rendered output", () => {
    expect(renderCliOutput(baseOutput, "text")).toEndWith("\n");
  });
});

describe("resolveOutputTarget", () => {
  test("selects stdout when no output path is configured", () => {
    expect(resolveOutputTarget()).toEqual({ type: "stdout" });
  });

  test("resolves file output paths", () => {
    expect(resolveOutputTarget("reports/findings.txt")).toEqual({
      type: "file",
      path: `${process.cwd()}/reports/findings.txt`,
      dir: `${process.cwd()}/reports`,
    });
  });
});

describe("createProgram", () => {
  test("creates the configured command program", () => {
    const program = createProgram();

    expect(program.name()).toBe("sql-antipattern-detector");
    expect(program.description()).toBe("Detect SQL antipatterns in Java/jOOQ codebases with an LLM-backed analyzer.");
    expect(program.options.some((option) => option.long === "--format")).toBe(true);
  });
});
