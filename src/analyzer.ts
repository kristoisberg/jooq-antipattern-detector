import pLimit from "p-limit";
import { generateObject } from "ai";
import type { LanguageModelV1 } from "ai";

import type { AppConfig } from "./config.js";
import type { FileCandidate } from "./file-discovery.js";
import { createModel, parseModelIdentifier, resolvePromptCharacterBudget } from "./model.js";
import { buildPrompt } from "./prompt-builder.js";
import type { PromptSet } from "./prompts.js";
import {
  classificationAnalysisResponseSchema,
  localisationAnalysisResponseSchema,
  type AnalysisUsage,
  type ClassificationAnalysisResponse,
  type AntipatternName,
  type FileAnalysis,
  type RunSummary,
} from "./types.js";

export type AnalyzeOptions = Pick<
  AppConfig,
  | "model"
  | "mode"
  | "concurrency"
  | "retries"
  | "temperature"
  | "thinkingEffort"
  | "maxPromptChars"
  | "debug"
  | "apiKeys"
>;

type AnalysisObjectResult = Promise<{
  object: object;
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
    mode: AppConfig["mode"],
    temperature: AppConfig["temperature"],
    thinkingEffort: AppConfig["thinkingEffort"],
  ) => AnalysisObjectResult;
  writeDebug: (message: string) => void;
};

const defaultAnalyzerDeps: AnalyzerDeps = {
  createModel,
  generateAnalysisObject: (model, prompt, providerId, mode, temperature, thinkingEffort) => {
    const sharedOptions = {
      model,
      temperature,
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
    };

    if (mode === "classification") {
      return generateObject({
        ...sharedOptions,
        schema: classificationAnalysisResponseSchema,
      });
    }

    return generateObject({
      ...sharedOptions,
      schema: localisationAnalysisResponseSchema,
    });
  },
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
  const providerId = parseModelIdentifier(options.model).providerId;
  const promptCharacterBudget = resolvePromptCharacterBudget(options.model, options.maxPromptChars);
  const limit = pLimit(Math.max(1, options.concurrency));

  const analyses = await Promise.all(
    candidates.map((candidate) =>
      limit(async () => {
        const prompt = buildPrompt(candidate, prompts, promptCharacterBudget);

        return analyzeWithRetry(model, providerId, candidate, prompt, options, deps).catch((error) =>
          buildFailedAnalysis(candidate, error, options.mode),
        );
      }),
    ),
  );

  analyses.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const summary = createEmptySummary(candidates.length);
  const distinctAntipatterns = new Set<string>();

  for (const analysis of analyses) {
    accumulateAnalysis(summary, distinctAntipatterns, analysis);
  }

  summary.distinctAntipatterns = distinctAntipatterns.size;

  return { analyses, summary };
}

function buildFailedAnalysis(candidate: FileCandidate, error: unknown, mode: AppConfig["mode"]): FileAnalysis {
  if (mode === "localisation") {
    return {
      filePath: candidate.absolutePath,
      relativePath: candidate.relativePath,
      promptType: candidate.promptType,
      occurrences: [],
      error: formatError(error),
    };
  }

  return {
    filePath: candidate.absolutePath,
    relativePath: candidate.relativePath,
    promptType: candidate.promptType,
    antipatterns: [],
    error: formatError(error),
  };
}

async function analyzeWithRetry(
  model: ReturnType<AnalyzerDeps["createModel"]>,
  providerId: string,
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
        providerId,
        options.mode,
        options.temperature,
        options.thinkingEffort,
      );
      const analysis = buildSuccessfulAnalysis(candidate, result.object, result.usage, options.mode);

      if (options.debug) {
        deps.writeDebug(`[analyzed] ${candidate.relativePath} (${candidate.promptType}, attempt ${attempt + 1})\n`);
      }

      return analysis;
    } catch (error) {
      lastError = error;
      if (options.debug) {
        deps.writeDebug(`[retry] ${candidate.relativePath} failed on attempt ${attempt + 1}: ${formatError(error)}\n`);
      }
    }
  }

  throw new Error(`Failed to analyze ${candidate.relativePath}: ${formatError(lastError)}`);
}

function buildSuccessfulAnalysis(
  candidate: FileCandidate,
  object: object,
  usage:
    | {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
      }
    | undefined,
  mode: AppConfig["mode"],
): FileAnalysis {
  const baseAnalysis = {
    filePath: candidate.absolutePath,
    relativePath: candidate.relativePath,
    promptType: candidate.promptType,
    usage: {
      inputTokens: usage?.promptTokens,
      outputTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens,
    },
  };

  if (mode === "classification") {
    const validatedObject = classificationAnalysisResponseSchema.parse(object);

    return {
      ...baseAnalysis,
      antipatterns: dedupeAntipatterns(validatedObject.antipatterns),
    };
  }

  const validatedObject = localisationAnalysisResponseSchema.parse(object);

  return {
    ...baseAnalysis,
    occurrences: validatedObject.occurrences,
  };
}

function dedupeAntipatterns(antipatterns: ClassificationAnalysisResponse["antipatterns"]): AntipatternName[] {
  return [...new Set(antipatterns)];
}

function createEmptySummary(applicableFiles: number): RunSummary {
  return {
    scannedJavaFiles: 0,
    applicableFiles,
    analyzedFiles: 0,
    failedFiles: 0,
    filesWithFindings: 0,
    totalOccurrences: 0,
    distinctAntipatterns: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
}

function accumulateAnalysis(summary: RunSummary, distinctAntipatterns: Set<string>, analysis: FileAnalysis): void {
  if (analysis.error) {
    summary.failedFiles += 1;
  } else {
    summary.analyzedFiles += 1;

    for (const antipattern of getAnalysisAntipatterns(analysis)) {
      distinctAntipatterns.add(antipattern);
    }
  }

  const findingCount = getAnalysisFindingCount(analysis);

  if (findingCount > 0) {
    summary.filesWithFindings += 1;
  }

  summary.totalOccurrences += findingCount;
  summary.inputTokens += analysis.usage?.inputTokens ?? 0;
  summary.outputTokens += analysis.usage?.outputTokens ?? 0;
  summary.totalTokens += analysis.usage?.totalTokens ?? 0;
}

function getAnalysisFindingCount(analysis: FileAnalysis): number {
  return "occurrences" in analysis ? analysis.occurrences.length : analysis.antipatterns.length;
}

function getAnalysisAntipatterns(analysis: FileAnalysis): string[] {
  return "occurrences" in analysis
    ? analysis.occurrences.map((occurrence) => occurrence.antipatternName)
    : analysis.antipatterns;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function supportsThinkingEffort(providerId: string): boolean {
  return providerId === "openai" || providerId === "openrouter";
}
