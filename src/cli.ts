#!/usr/bin/env bun

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Command } from "commander";

import { analyzeFiles } from "./analyzer.js";
import { parseInteger, resolveConfig } from "./config.js";
import { discoverApplicableFiles } from "./file-discovery.js";
import { renderTextReport, type CliOutput } from "./output.js";
import { loadPrompts } from "./prompts.js";

const program = new Command();

program
  .name("sql-antipattern-detector")
  .description("Detect SQL antipatterns in Java/jOOQ codebases with an LLM-backed analyzer.")
  .argument("[directory]", "Directory to scan recursively for Java files")
  .option(
    "-m, --model <model>",
    'Model identifier. Prefix with "google:", "anthropic:", "openai:", or "openrouter:" if needed.',
  )
  .option("-c, --concurrency <number>", "Number of files to analyze concurrently", parseInteger)
  .option("-r, --retries <number>", "Retries per file on transient model failures", parseInteger)
  .option("-f, --format <format>", "Output format: text or json")
  .option("-o, --output <file>", "Write output to a file instead of stdout")
  .option("--debug", "Print per-file progress and retries to stderr")
  .option("--gemini-api-key <key>", "Google Gemini API key")
  .option("--anthropic-api-key <key>", "Anthropic API key")
  .option("--openai-api-key <key>", "OpenAI API key")
  .option("--openrouter-api-key <key>", "OpenRouter API key")
  .action(async (directory: string | undefined, options) => {
    const config = resolveConfig({
      directory,
      model: options.model,
      concurrency: options.concurrency,
      retries: options.retries,
      format: options.format,
      output: options.output,
      debug: options.debug,
      geminiApiKey: options.geminiApiKey,
      anthropicApiKey: options.anthropicApiKey,
      openaiApiKey: options.openaiApiKey,
      openrouterApiKey: options.openrouterApiKey,
    });
    const rootDirectory = path.resolve(config.directory);
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

    const payload: CliOutput = {
      rootDirectory,
      model: config.model,
      generatedAt: new Date().toISOString(),
      results: analyses,
      summary,
    };

    const renderedOutput =
      config.format === "json" ? `${JSON.stringify(payload, null, 2)}\n` : `${renderTextReport(payload)}\n`;

    if (config.output) {
      const outputPath = path.resolve(config.output);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, renderedOutput, "utf8");
    } else {
      process.stdout.write(renderedOutput);
    }
  });

await program.parseAsync(process.argv);
