import path from "node:path";

import { analyzeFiles, type AnalyzeOptions } from "./analyzer.js";
import type { AppConfig } from "./config.js";
import { discoverApplicableFiles } from "./file-discovery.js";
import type { CliOutput } from "./output.js";
import { getPrompts } from "./prompts.js";
import type { FileAnalysis, RunSummary } from "./types.js";

export function buildAnalyzeOptions(config: AppConfig): AnalyzeOptions {
  return {
    model: config.model,
    concurrency: config.concurrency,
    retries: config.retries,
    thinkingEffort: config.thinkingEffort,
    debug: config.debug,
    apiKeys: config.apiKeys,
  };
}

export function createCliOutput(
  rootDirectory: string,
  model: string,
  analyses: FileAnalysis[],
  summary: RunSummary,
  now: Date = new Date(),
): CliOutput {
  return {
    rootDirectory,
    model,
    generatedAt: now.toISOString(),
    results: analyses,
    summary,
  };
}

export async function runAnalysis(directory: string, config: AppConfig): Promise<CliOutput> {
  const rootDirectory = path.resolve(directory);
  const prompts = getPrompts();
  const discovery = await discoverApplicableFiles(rootDirectory);
  const { analyses, summary } = await analyzeFiles(discovery.candidates, prompts, buildAnalyzeOptions(config));

  summary.scannedJavaFiles = discovery.allJavaFiles.length;

  return createCliOutput(rootDirectory, config.model, analyses, summary);
}
