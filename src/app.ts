import path from "node:path";

import { analyzeFiles } from "./analyzer.js";
import type { AppConfig } from "./config.js";
import { discoverApplicableFiles } from "./file-discovery.js";
import type { CliOutput } from "./output.js";
import { loadPrompts } from "./prompts.js";

export type AppDeps = {
  loadPrompts: typeof loadPrompts;
  discoverApplicableFiles: typeof discoverApplicableFiles;
  analyzeFiles: typeof analyzeFiles;
  now: () => Date;
};

const defaultAppDeps: AppDeps = {
  loadPrompts,
  discoverApplicableFiles,
  analyzeFiles,
  now: () => new Date(),
};

export async function runAnalysis(
  directory: string,
  config: AppConfig,
  deps: AppDeps = defaultAppDeps,
): Promise<CliOutput> {
  const rootDirectory = path.resolve(directory);
  const prompts = await deps.loadPrompts();
  const discovery = await deps.discoverApplicableFiles(rootDirectory);

  const { analyses, summary } = await deps.analyzeFiles(discovery.candidates, prompts, {
    model: config.model,
    concurrency: config.concurrency,
    retries: config.retries,
    debug: config.debug,
    apiKeys: config.apiKeys,
  });

  summary.scannedJavaFiles = discovery.allJavaFiles.length;

  return {
    rootDirectory,
    model: config.model,
    generatedAt: deps.now().toISOString(),
    results: analyses,
    summary,
  };
}
