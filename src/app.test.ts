import { describe, expect, test } from "bun:test";

import { runAnalysis, type AppDeps } from "./app.js";
import type { AppConfig } from "./config.js";
import type { FileCandidate, DiscoveryResult } from "./file-discovery.js";
import type { PromptSet } from "./prompts.js";

describe("runAnalysis", () => {
  test("orchestrates dependencies and returns the final cli payload", async () => {
    const prompts: PromptSet = {
      ddl: "ddl",
      dmlDql: "dml",
    };
    const discovery: DiscoveryResult = {
      allJavaFiles: ["/tmp/project/A.java", "/tmp/project/B.java", "/tmp/project/C.java"],
      candidates: [
        {
          absolutePath: "/tmp/project/A.java",
          relativePath: "A.java",
          contents: "class A {}",
          promptType: "ddl",
          closestKeysContents: "",
        } satisfies FileCandidate,
      ],
    };
    const analyses = [
      {
        filePath: "/tmp/project/A.java",
        relativePath: "A.java",
        promptType: "ddl" as const,
        occurrences: [],
      },
    ];
    const summary = {
      scannedJavaFiles: 0,
      applicableFiles: 1,
      analyzedFiles: 1,
      failedFiles: 0,
      filesWithFindings: 0,
      totalOccurrences: 0,
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
    };
    const config: AppConfig = {
      model: "google:gemini-2.5-pro",
      concurrency: 3,
      retries: 4,
      format: "json",
      debug: true,
      apiKeys: {
        gemini: "test-key",
      },
    };
    const calls: string[] = [];
    const deps: AppDeps = {
      loadPrompts: async () => {
        calls.push("loadPrompts");
        return prompts;
      },
      discoverApplicableFiles: async (rootDirectory) => {
        calls.push(`discover:${rootDirectory}`);
        return discovery;
      },
      analyzeFiles: async (candidates, loadedPrompts, options) => {
        calls.push(
          `analyze:${candidates.length}:${loadedPrompts.ddl}:${options.model}:${options.concurrency}:${options.retries}`,
        );
        return {
          analyses,
          summary: { ...summary },
        };
      },
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    };

    const result = await runAnalysis("./project", config, deps);

    expect(calls).toEqual([
      "loadPrompts",
      `discover:${process.cwd()}/project`,
      "analyze:1:ddl:google:gemini-2.5-pro:3:4",
    ]);
    expect(result).toEqual({
      rootDirectory: `${process.cwd()}/project`,
      model: "google:gemini-2.5-pro",
      generatedAt: "2025-01-01T00:00:00.000Z",
      results: analyses,
      summary: {
        ...summary,
        scannedJavaFiles: 3,
      },
    });
  });
});
