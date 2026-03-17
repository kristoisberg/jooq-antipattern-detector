import { describe, expect, test } from "bun:test";
import type { LanguageModelV1 } from "ai";

import { analyzeFiles, type AnalyzerDeps, type AnalyzeOptions } from "../analyzer.js";
import type { FileCandidate } from "../file-discovery.js";
import type { PromptSet } from "../prompts.js";

const prompts: PromptSet = {
  ddl: "DDL FILE_CONTENTS KEYS_CONTENTS",
  dmlDql: "DML FILE_CONTENTS",
};

const candidates: FileCandidate[] = [
  {
    absolutePath: "/tmp/project/b.java",
    relativePath: "b.java",
    contents: "b",
    promptType: "dml-dql",
    closestKeysContents: "",
  },
  {
    absolutePath: "/tmp/project/a.java",
    relativePath: "a.java",
    contents: "a",
    promptType: "ddl",
    closestKeysContents: "keys",
  },
];

const options: AnalyzeOptions = {
  model: "google:gemini-2.5-pro",
  concurrency: 2,
  retries: 2,
  thinkingEffort: "medium",
  debug: true,
  apiKeys: {
    gemini: "test-key",
  },
};

describe("analyzeFiles", () => {
  test("retries failed analyses, sorts results, aggregates usage, and writes debug output", async () => {
    const debugMessages: string[] = [];
    const attempts = new Map<string, number>();
    const promptsSeen: string[] = [];

    const deps: AnalyzerDeps = {
      createModel: () => ({ provider: "fake-model" }) as LanguageModelV1,
      generateAnalysisObject: async (_model, prompt, providerId, thinkingEffort) => {
        promptsSeen.push(prompt);
        expect(providerId).toBe("google");
        expect(thinkingEffort).toBe("medium");
        const currentAttempt = (attempts.get(prompt) ?? 0) + 1;
        attempts.set(prompt, currentAttempt);

        if (prompt.includes("1: b") && currentAttempt === 1) {
          throw new Error("temporary failure");
        }

        if (prompt.includes("1: a")) {
          return {
            object: {
              occurrences: [
                {
                  antipatternName: "ID Required",
                  linesRangeStart: 2,
                  linesRangeEnd: 4,
                  codeFragment: "id",
                  reasoning: "bad key",
                },
              ],
            },
            usage: {
              promptTokens: 3,
              completionTokens: 4,
              totalTokens: 7,
            },
          };
        }

        return {
          object: {
            occurrences: [],
          },
          usage: {
            promptTokens: 5,
            completionTokens: 6,
            totalTokens: 11,
          },
        };
      },
      writeDebug: (message) => {
        debugMessages.push(message);
      },
    };

    const result = await analyzeFiles(candidates, prompts, options, deps);

    expect(result.analyses.map((analysis) => analysis.relativePath)).toEqual(["a.java", "b.java"]);
    expect(result.summary).toEqual({
      scannedJavaFiles: 0,
      applicableFiles: 2,
      analyzedFiles: 2,
      failedFiles: 0,
      filesWithFindings: 1,
      totalOccurrences: 1,
      inputTokens: 8,
      outputTokens: 10,
      totalTokens: 18,
    });
    expect(debugMessages).toContain("[retry] b.java failed on attempt 1: temporary failure\n");
    expect(debugMessages).toContain("[analyzed] a.java (ddl, attempt 1)\n");
    expect(debugMessages).toContain("[analyzed] b.java (dml-dql, attempt 2)\n");
    expect(promptsSeen.some((prompt) => prompt.includes("1: a"))).toBe(true);
    expect(promptsSeen.some((prompt) => prompt.includes("1: b"))).toBe(true);
  });

  test("converts exhausted retries into file analysis errors", async () => {
    const deps: AnalyzerDeps = {
      createModel: () => ({ provider: "fake-model" }) as LanguageModelV1,
      generateAnalysisObject: async (_model, _prompt, providerId, thinkingEffort) => {
        expect(providerId).toBe("google");
        expect(thinkingEffort).toBe("medium");
        throw new Error("always failing");
      },
      writeDebug: () => {},
    };

    const result = await analyzeFiles([candidates[0]], prompts, { ...options, retries: 1, debug: false }, deps);

    expect(result.analyses).toEqual([
      {
        filePath: "/tmp/project/b.java",
        relativePath: "b.java",
        promptType: "dml-dql",
        occurrences: [],
        error: "Failed to analyze b.java: always failing",
      },
    ]);
    expect(result.summary.failedFiles).toBe(1);
    expect(result.summary.analyzedFiles).toBe(0);
    expect(result.summary.totalOccurrences).toBe(0);
  });
});
