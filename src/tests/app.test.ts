import { describe, expect, test } from "bun:test";

import { buildAnalyzeOptions, createCliOutput } from "../app.js";
import type { AppConfig } from "../config.js";
import type { RunSummary } from "../types.js";

describe("buildAnalyzeOptions", () => {
  test("maps app config to analyzer options", () => {
    const config: AppConfig = {
      model: "google:gemini-2.5-pro",
      concurrency: 3,
      retries: 4,
      thinkingEffort: "high",
      format: "json",
      debug: true,
      apiKeys: {
        gemini: "test-key",
      },
    };

    expect(buildAnalyzeOptions(config)).toEqual({
      model: "google:gemini-2.5-pro",
      concurrency: 3,
      retries: 4,
      thinkingEffort: "high",
      debug: true,
      apiKeys: {
        gemini: "test-key",
      },
    });
  });
});

describe("createCliOutput", () => {
  test("builds the final cli payload", () => {
    const summary: RunSummary = {
      scannedJavaFiles: 3,
      applicableFiles: 1,
      analyzedFiles: 1,
      failedFiles: 0,
      filesWithFindings: 0,
      totalOccurrences: 0,
      distinctAntipatterns: 0,
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
    };
    const analyses = [
      {
        filePath: "/tmp/project/A.java",
        relativePath: "A.java",
        promptType: "ddl" as const,
        occurrences: [],
      },
    ];

    expect(
      createCliOutput("/tmp/project", "google:gemini-2.5-pro", analyses, summary, new Date("2025-01-01T00:00:00.000Z")),
    ).toEqual({
      rootDirectory: "/tmp/project",
      model: "google:gemini-2.5-pro",
      generatedAt: "2025-01-01T00:00:00.000Z",
      results: analyses,
      summary,
    });
  });
});
