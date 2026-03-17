import { generateObject } from "ai";

import type { ResolvedConfig } from "./config.js";
import type { FileCandidate } from "./file-discovery.js";
import { createModel } from "./model.js";
import { buildPrompt } from "./prompt-builder.js";
import type { PromptSet } from "./prompts.js";
import { analysisResponseSchema, type FileAnalysis, type RunSummary } from "./types.js";

export type AnalyzeOptions = {
  model: string;
  concurrency: number;
  retries: number;
  debug: boolean;
  apiKeys: ResolvedConfig["apiKeys"];
};

export async function analyzeFiles(
  candidates: FileCandidate[],
  prompts: PromptSet,
  options: AnalyzeOptions,
): Promise<{ analyses: FileAnalysis[]; summary: RunSummary }> {
  const model = createModel(options.model, options.apiKeys);
  const analyses: FileAnalysis[] = [];
  const workers = Array.from({ length: Math.max(1, options.concurrency) }, (_, workerIndex) =>
    runWorker(workerIndex, model, candidates, prompts, options, analyses),
  );

  await Promise.all(workers);
  analyses.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  const summary = analyses.reduce<RunSummary>(
    (acc, analysis) => {
      if (analysis.error) {
        acc.failedFiles += 1;
      } else {
        acc.analyzedFiles += 1;
      }
      if (analysis.occurrences.length > 0) {
        acc.filesWithFindings += 1;
      }
      acc.totalOccurrences += analysis.occurrences.length;
      acc.inputTokens += analysis.usage?.inputTokens ?? 0;
      acc.outputTokens += analysis.usage?.outputTokens ?? 0;
      acc.totalTokens += analysis.usage?.totalTokens ?? 0;
      return acc;
    },
    {
      scannedJavaFiles: 0,
      applicableFiles: candidates.length,
      analyzedFiles: 0,
      failedFiles: 0,
      filesWithFindings: 0,
      totalOccurrences: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
  );

  return { analyses, summary };
}

async function runWorker(
  workerIndex: number,
  model: ReturnType<typeof createModel>,
  candidates: FileCandidate[],
  prompts: PromptSet,
  options: AnalyzeOptions,
  analyses: FileAnalysis[],
): Promise<void> {
  for (let index = workerIndex; index < candidates.length; index += Math.max(1, options.concurrency)) {
    const candidate = candidates[index];
    const prompt = buildPrompt(candidate, prompts);
    const analysis = await analyzeSingleFile(model, candidate, prompt, options).catch((error) => ({
      filePath: candidate.absolutePath,
      relativePath: candidate.relativePath,
      promptType: candidate.promptType,
      occurrences: [],
      error: formatError(error),
    }));
    analyses.push(analysis);
  }
}

async function analyzeSingleFile(
  model: ReturnType<typeof createModel>,
  candidate: FileCandidate,
  prompt: string,
  options: AnalyzeOptions,
): Promise<FileAnalysis> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      const result = await generateObject({
        model,
        schema: analysisResponseSchema,
        temperature: 0,
        prompt,
      });

      if (options.debug) {
        process.stderr.write(
          `[analyzed] ${candidate.relativePath} (${candidate.promptType}, attempt ${attempt + 1})\n`,
        );
      }

      return {
        filePath: candidate.absolutePath,
        relativePath: candidate.relativePath,
        promptType: candidate.promptType,
        occurrences: result.object.occurrences,
        usage: {
          inputTokens: result.usage?.promptTokens,
          outputTokens: result.usage?.completionTokens,
          totalTokens: result.usage?.totalTokens,
        },
      };
    } catch (error) {
      lastError = error;
      if (options.debug) {
        process.stderr.write(
          `[retry] ${candidate.relativePath} failed on attempt ${attempt + 1}: ${formatError(error)}\n`,
        );
      }
    }
  }

  throw new Error(`Failed to analyze ${candidate.relativePath}: ${formatError(lastError)}`);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
