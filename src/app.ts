import path from "node:path";

import { analyzeFiles } from "./analyzer.js";
import type { AppConfig } from "./config.js";
import { discoverApplicableFiles } from "./file-discovery.js";
import type { CliOutput } from "./output.js";
import { loadPrompts } from "./prompts.js";

export async function runAnalysis(directory: string, config: AppConfig): Promise<CliOutput> {
  const rootDirectory = path.resolve(directory);
  const prompts = await loadPrompts();
  const discovery = await discoverApplicableFiles(rootDirectory);

  const { analyses, summary } = await analyzeFiles(discovery.candidates, prompts, {
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
    generatedAt: new Date().toISOString(),
    results: analyses,
    summary,
  };
}
