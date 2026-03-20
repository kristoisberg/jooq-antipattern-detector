import pLimit from "p-limit";
import { generateObject } from "ai";
import type { LanguageModelV1 } from "ai";

import type { AppConfig } from "./config.js";
import type { FileCandidate } from "./file-discovery.js";
import { createModel } from "./model.js";
import { buildPrompt } from "./prompt-builder.js";
import type { PromptSet } from "./prompts.js";
import { analysisResponseSchema, type AnalysisUsage, type FileAnalysis, type RunSummary } from "./types.js";

export type AnalyzeOptions = Pick<
  AppConfig,
  "model" | "concurrency" | "retries" | "thinkingEffort" | "debug" | "apiKeys"
>;

type AnalysisObjectResult = Promise<{
  object: {
    occurrences: FileAnalysis["occurrences"];
  };
  usage?: AnalysisUsage & {
    promptTokens?: number;
    completionTokens?: number;
  };
}>;

export type AnalyzerDeps = {
  createModel: typeof createModel;
  generateAnalysisObject: (
    model: LanguageModelV1,
    prompt: string,
    providerId: string,
    thinkingEffort: AppConfig["thinkingEffort"],
  ) => AnalysisObjectResult;
  writeDebug: (message: string) => void;
};

const defaultAnalyzerDeps: AnalyzerDeps = {
  createModel,
  generateAnalysisObject: (model, prompt, providerId, thinkingEffort) =>
    generateObject({
      model,
      schema: analysisResponseSchema,
      temperature: 0,
      prompt,
      ...(supportsThinkingEffort(providerId)
        ? {
            providerOptions: {
              openai: {
                reasoningEffort: thinkingEffort,
              },
            },
          }
        : {}),
    }),
  writeDebug: (message) => {
    process.stderr.write(message);
  },
};

export async function analyzeFiles(
  candidates: FileCandidate[],
  prompts: PromptSet,
  options: AnalyzeOptions,
  deps: AnalyzerDeps = defaultAnalyzerDeps,
): Promise<{ analyses: FileAnalysis[]; summary: RunSummary }> {
  const model = deps.createModel(options.model, options.apiKeys);
  const limit = pLimit(Math.max(1, options.concurrency));

  const analyses = await Promise.all(
    candidates.map((candidate) =>
      limit(async () => {
        const prompt = buildPrompt(candidate, prompts);

        return analyzeWithRetry(model, candidate, prompt, options, deps).catch((error) =>
          buildFailedAnalysis(candidate, error),
        );
      }),
    ),
  );

  analyses.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  const distinctAntipatterns = new Set<FileAnalysis["occurrences"][number]["antipatternName"]>();

  const summary = analyses.reduce<RunSummary>(
    (acc, analysis) => {
      if (analysis.error) {
        acc.failedFiles += 1;
      } else {
        acc.analyzedFiles += 1;
        for (const occurrence of analysis.occurrences) {
          distinctAntipatterns.add(occurrence.antipatternName);
        }
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
      distinctAntipatterns: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
  );

  summary.distinctAntipatterns = distinctAntipatterns.size;

  return { analyses, summary };
}

function buildFailedAnalysis(candidate: FileCandidate, error: unknown): FileAnalysis {
  return {
    filePath: candidate.absolutePath,
    relativePath: candidate.relativePath,
    promptType: candidate.promptType,
    occurrences: [],
    error: formatError(error),
  };
}

async function analyzeWithRetry(
  model: ReturnType<AnalyzerDeps["createModel"]>,
  candidate: FileCandidate,
  prompt: string,
  options: AnalyzeOptions,
  deps: AnalyzerDeps,
): Promise<FileAnalysis> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      const result = await deps.generateAnalysisObject(
        model,
        prompt,
        getProviderId(options.model),
        options.thinkingEffort,
      );

      if (options.debug) {
        deps.writeDebug(`[analyzed] ${candidate.relativePath} (${candidate.promptType}, attempt ${attempt + 1})\n`);
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
        deps.writeDebug(`[retry] ${candidate.relativePath} failed on attempt ${attempt + 1}: ${formatError(error)}\n`);
      }
    }
  }

  throw new Error(`Failed to analyze ${candidate.relativePath}: ${formatError(lastError)}`);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getProviderId(modelId: string): string {
  const separatorIndex = modelId.indexOf(":");
  return separatorIndex === -1 ? "" : modelId.slice(0, separatorIndex).trim();
}

function supportsThinkingEffort(providerId: string): boolean {
  return providerId === "openai" || providerId === "openrouter";
}
